import os
import sys
import time
import torch
import psutil
import rasterio
import torch.nn.functional as F
from omegaconf import OmegaConf

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(base_dir, "NASA-IBM-Lunar-Foundation-Model"))
sys.path.append(base_dir)

from terratorch_integration.lunar_backbone import LunarBackbone
from laep.lfm.encoder import LAEPContextEncoder
from laep.lfm.cache import LAEPEmbeddingCache

def extract_spatial_features(token_sequence):
    B, N, D = token_sequence.shape
    H = W = int(N ** 0.5)
    spatial_map = token_sequence.view(B, H, W, D).permute(0, 3, 1, 2)
    return spatial_map

def get_memory_mb():
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)

def run_pipeline(lfm, encoder, sample_tensors):
    with torch.no_grad():
        t0 = time.time()
        lfm_out = lfm({"slope": sample_tensors})
        native = extract_spatial_features(lfm_out[-1])
        context = encoder(native)
        t1 = time.time()
        
    return context, (t1 - t0)

def compute_stats(tensor):
    return {
        "mean": tensor.mean().item(),
        "std": tensor.std().item(),
        "min": tensor.min().item(),
        "max": tensor.max().item(),
        "nans": torch.isnan(tensor).sum().item(),
        "infs": torch.isinf(tensor).sum().item(),
    }

def main():
    print("=== LAEP LFM Branch End-to-End Validation ===")
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Device] Using: {device}")
    
    mem_start = get_memory_mb()
    
    # 1. Setup Models
    config_path = os.path.join(base_dir, "backbone", "config.yaml")
    ckpt_path = os.path.join(base_dir, "backbone", "checkpoint.pt")
    cfg = OmegaConf.load(config_path)
    
    print("\n[Loading Models] NASA-IBM LFM and LAEP Context Encoder...")
    lfm = LunarBackbone(variant="base", modalities=["slope"], cfg=cfg, checkpoint_path=ckpt_path)
    lfm.eval()
    lfm.to(device)
    
    encoder = LAEPContextEncoder()
    # If there is a saved encoder, load it. If not, use random init to test pipeline.
    enc_path = os.path.join(base_dir, "laep_context_encoder.pt")
    if os.path.exists(enc_path):
        encoder.load(enc_path, device)
    encoder.eval()
    encoder.to(device)
    
    cache = LAEPEmbeddingCache(base_dir=os.path.join(base_dir, "data"))
    
    mem_models = get_memory_mb()
    print(f"Memory after loading models: {mem_models - mem_start:.2f} MB")
    
    # 2. Setup Data
    sample_names = ["patch_0007_0006_80N_SLOPE.tif", "patch_0007_0006_S_80S_SLOPE.tif"]
    tensors = []
    
    for name in sample_names:
        path = os.path.join(base_dir, "data", "prospectivity_dataset", name)
        with rasterio.open(path) as src:
            img = src.read(1)
            tensor = torch.from_numpy(img).float().unsqueeze(0).unsqueeze(0).to(device)
            tensors.append(tensor)
            
    # Test Individual Processing and Determinism
    print("\n[Validation 1-6] Individual Processing & Determinism")
    embeddings = []
    for i, t in enumerate(tensors):
        print(f"\nProcessing Sample {i+1}: {sample_names[i]}")
        emb1, time1 = run_pipeline(lfm, encoder, t)
        emb2, time2 = run_pipeline(lfm, encoder, t)
        
        # Validate shape
        assert emb1.shape == (1, 256), f"Shape is {emb1.shape}, expected (1, 256)"
        
        # Validate determinism
        diff = torch.max(torch.abs(emb1 - emb2)).item()
        assert diff < 1e-5, f"Non-deterministic behavior detected! Max diff: {diff}"
        
        # Validate No NaN/Inf
        assert torch.isnan(emb1).sum() == 0, "NaN found in embeddings!"
        assert torch.isinf(emb1).sum() == 0, "Inf found in embeddings!"
        
        print(f"-> Shape: {emb1.shape}")
        print(f"-> Time: {time1:.3f}s")
        print("-> Determinism, NaN, Inf tests passed.")
        
        embeddings.append(emb1)
        
    print("\n[Validation 2] Differential Embeddings")
    similarity = F.cosine_similarity(embeddings[0], embeddings[1]).item()
    print(f"Cosine Similarity (Sample 1 vs Sample 2): {similarity:.4f}")
    assert similarity < 0.999, "Different samples produced identical embeddings!"
    
    # Statistics
    print("\n[Sanity Checks] Embedding Statistics")
    for i, emb in enumerate(embeddings):
        stats = compute_stats(emb)
        print(f"Sample {i+1} Stats: {stats}")
        
    # Batch Processing
    print("\n[Validation 10] Batch Inference")
    batch_tensor = torch.cat(tensors, dim=0)
    batch_emb, batch_time = run_pipeline(lfm, encoder, batch_tensor)
    print(f"Batch processing time (N=2): {batch_time:.3f}s")
    assert batch_emb.shape == (2, 256), f"Batch shape is {batch_emb.shape}"
    
    diff_batch_0 = torch.max(torch.abs(batch_emb[0:1] - embeddings[0])).item()
    diff_batch_1 = torch.max(torch.abs(batch_emb[1:2] - embeddings[1])).item()
    print(f"Batch consistency (max diff from individual): S1={diff_batch_0:.6f}, S2={diff_batch_1:.6f}")
    
    # Cache
    print("\n[Validation 7] Cache Verification")
    metadata_batch = {
        "sample_id": "batch_test",
        "modality": "slope",
        "model_checkpoint": "NASA_IBM_LFM_base",
        "config_id": "test_config"
    }
    
    cache.save_context(batch_emb, metadata_batch)
    cached_emb, cached_meta = cache.load_context(metadata_batch)
    
    assert cached_emb is not None
    assert torch.allclose(batch_emb.cpu(), cached_emb), "Cached embedding differs from original!"
    print("Cache correctly saves and loads equivalent tensors.")
    
    print("\n=== Validation Complete ===")

if __name__ == '__main__':
    main()
