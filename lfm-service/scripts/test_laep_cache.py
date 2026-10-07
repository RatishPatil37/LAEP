import os
import sys
import torch
import time
import rasterio
from omegaconf import OmegaConf

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(base_dir, "NASA-IBM-Lunar-Foundation-Model"))
sys.path.append(base_dir)

from terratorch_integration.lunar_backbone import LunarBackbone
from laep.lfm.encoder import LAEPContextEncoder
from laep.lfm.cache import LAEPEmbeddingCache

# Keep track of execution counts to prove we didn't rerun models
LFM_EXECUTION_COUNT = 0
ENCODER_EXECUTION_COUNT = 0

def extract_spatial_features(token_sequence):
    B, N, D = token_sequence.shape
    H = W = int(N ** 0.5)
    spatial_map = token_sequence.view(B, H, W, D).permute(0, 3, 1, 2)
    return spatial_map

def run_lfm_inference(model, tensor_img, metadata):
    """Wrapper to track executions of the LFM"""
    global LFM_EXECUTION_COUNT
    LFM_EXECUTION_COUNT += 1
    with torch.no_grad():
        outputs = model({"slope": tensor_img})
    return extract_spatial_features(outputs[-1])

def run_context_encoder(encoder, spatial_features, metadata):
    """Wrapper to track executions of the Context Encoder"""
    global ENCODER_EXECUTION_COUNT
    ENCODER_EXECUTION_COUNT += 1
    return encoder(spatial_features)

def execute_pipeline(cache, lfm_model, context_encoder, sample_tensor, metadata):
    """
    Core pipeline logic showing proper two-level cache resolution
    """
    # 1. Native Representation
    cached_native = cache.load_native(metadata)
    
    if cached_native is not None:
        print("  -> CACHE HIT [Level 1]: Native LFM Representation loaded from cache.")
        native_features = cached_native[0]
    else:
        print("  -> CACHE MISS [Level 1]: Executing NASA-IBM LFM...")
        native_features = run_lfm_inference(lfm_model, sample_tensor, metadata)
        cache.save_native(native_features, metadata)
        print("  -> Cache updated [Level 1].")
        
    # 2. Context Representation
    cached_context = cache.load_context(metadata)
    
    if cached_context is not None:
        print("  -> CACHE HIT [Level 2]: 256-D Context Vector loaded from cache.")
        context_vector = cached_context[0]
    else:
        print("  -> CACHE MISS [Level 2]: Executing LAEP Context Encoder...")
        context_vector = run_context_encoder(context_encoder, native_features, metadata)
        cache.save_context(context_vector, metadata)
        print("  -> Cache updated [Level 2].")
        
    return context_vector

def main():
    global LFM_EXECUTION_COUNT, ENCODER_EXECUTION_COUNT
    data_dir = os.path.join(base_dir, "data")
    
    # Initialize components
    cache = LAEPEmbeddingCache(base_dir=data_dir)
    
    config_path = os.path.join(base_dir, "backbone", "config.yaml")
    ckpt_path = os.path.join(base_dir, "backbone", "checkpoint.pt")
    cfg = OmegaConf.load(config_path)
    
    print("Loading models...")
    lfm_model = LunarBackbone(variant="base", modalities=["slope"], cfg=cfg, checkpoint_path=ckpt_path)
    lfm_model.eval()
    
    context_encoder = LAEPContextEncoder()
    context_encoder.eval()
    print("Models ready.\n")
    
    # Load Sample
    sample_filename = "patch_0007_0006_80N_SLOPE.tif"
    sample_path = os.path.join(base_dir, "data", "prospectivity_dataset", sample_filename)
    with rasterio.open(sample_path) as src:
        img = src.read(1)
        
    sample_tensor = torch.from_numpy(img).float().unsqueeze(0).unsqueeze(0)
    
    # Define rich metadata
    metadata = {
        "sample_id": sample_filename.replace(".tif", ""),
        "dataset": "sombench_ice_prospectivity",
        "spatial_coordinates": "80N",
        "modality": "slope",
        "model_checkpoint": "NASA_IBM_LFM_base_v1",
        "config_id": "pretrain_config",
        "embedding_dim": 256,
        "version": "1.0"
    }
    
    # Run 1: Should MISS cache and execute models
    print("=== PASS 1: Initial Processing ===")
    execute_pipeline(cache, lfm_model, context_encoder, sample_tensor, metadata)
    
    print("\nState after Pass 1:")
    print(f"LFM Executions: {LFM_EXECUTION_COUNT}")
    print(f"Context Encoder Executions: {ENCODER_EXECUTION_COUNT}")
    assert LFM_EXECUTION_COUNT == 1
    assert ENCODER_EXECUTION_COUNT == 1
    
    # Run 2: Should HIT cache and NOT execute models
    print("\n=== PASS 2: Cached Processing ===")
    execute_pipeline(cache, lfm_model, context_encoder, sample_tensor, metadata)
    
    print("\nState after Pass 2:")
    print(f"LFM Executions: {LFM_EXECUTION_COUNT}")
    print(f"Context Encoder Executions: {ENCODER_EXECUTION_COUNT}")
    assert LFM_EXECUTION_COUNT == 1, "ERROR: LFM was re-executed!"
    assert ENCODER_EXECUTION_COUNT == 1, "ERROR: Context Encoder was re-executed!"
    
    print("\n=== SUCCESS: Two-Level Cache Verified ===")
    
if __name__ == '__main__':
    main()
