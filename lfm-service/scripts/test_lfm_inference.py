import os
import sys
import time
import torch
import rasterio
from omegaconf import OmegaConf

# Add LFM package to path
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(base_dir, "NASA-IBM-Lunar-Foundation-Model"))

from terratorch_integration.lunar_backbone import LunarBackbone

def main():
    config_path = os.path.join(base_dir, "backbone", "config.yaml")
    ckpt_path = os.path.join(base_dir, "backbone", "checkpoint.pt")
    
    print("=== Configuration ===")
    print(f"Config path: {config_path}")
    print(f"Checkpoint path: {ckpt_path}")
    
    # Load config
    cfg = OmegaConf.load(config_path)
    
    # Initialize backbone
    # We use variant="base" and just one modality "slope" for our test patch
    print("\n=== Initializing Model ===")
    model = LunarBackbone(
        variant="base",
        modalities=["slope"],
        cfg=cfg,
        checkpoint_path=ckpt_path
    )
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()
    print(f"Model initialized. Device: {device}")

    # Load a single lunar sample from our dataset
    print("\n=== Loading Sample ===")
    sample_path = os.path.join(base_dir, "data", "prospectivity_dataset", "patch_0007_0006_80N_SLOPE.tif")
    print(f"Sample path: {sample_path}")
    
    with rasterio.open(sample_path) as src:
        img = src.read(1)  # Read band 1
        
    # Model expects shape (B, C, H, W)
    tensor_img = torch.from_numpy(img).float().unsqueeze(0).unsqueeze(0)
    tensor_img = tensor_img.to(device)
    
    # Official preprocessing mapping for LunarBackbone is a dict: { modality_name: tensor }
    input_dict = {"slope": tensor_img}
    
    print(f"Input modality: slope")
    print(f"Input tensor shape: {tensor_img.shape}")
    print(f"Input dtype: {tensor_img.dtype}")
    
    # Run Inference
    print("\n=== Running Inference ===")
    start_time = time.time()
    with torch.no_grad():
        outputs = model(input_dict)
    end_time = time.time()
    
    print("\n=== Inference Output Analysis ===")
    print(f"Native output type: {type(outputs)}")
    
    if isinstance(outputs, list):
        print(f"List length (likely encoder layers): {len(outputs)}")
        if len(outputs) > 0:
            print(f"Last Element (-1) Type: {type(outputs[-1])}")
            if isinstance(outputs[-1], torch.Tensor):
                print(f"Last Element (-1) Shape: {outputs[-1].shape}")
                print(f"Last Element (-1) Dtype: {outputs[-1].dtype}")
                
            print(f"First Element (0) Type: {type(outputs[0])}")
            if isinstance(outputs[0], torch.Tensor):
                print(f"First Element (0) Shape: {outputs[0].shape}")
                
    print(f"\nInference time: {end_time - start_time:.4f} seconds")
    if torch.cuda.is_available():
        print(f"GPU Memory Allocated: {torch.cuda.memory_allocated() / (1024*1024):.2f} MB")

if __name__ == '__main__':
    main()
