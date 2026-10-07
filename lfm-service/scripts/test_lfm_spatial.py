import os
import sys
import torch
import rasterio
from omegaconf import OmegaConf

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(base_dir, "NASA-IBM-Lunar-Foundation-Model"))

from terratorch_integration.lunar_backbone import LunarBackbone

def extract_spatial_features(token_sequence, patch_size=16):
    """
    Transforms the native (B, N, D) token sequence into a (B, D, H, W) spatial feature map.
    N = H * W. For a 256x256 input with 16x16 patches, N = 256, H = 16, W = 16.
    """
    B, N, D = token_sequence.shape
    H = W = int(N ** 0.5)
    
    # Verify square grid assumption for this specific test
    assert H * W == N, "Token sequence length is not a perfect square."
    
    # Reshape to spatial feature map (B, D, H, W)
    # 1. Reshape N into H, W -> (B, H, W, D)
    # 2. Permute to channel-first -> (B, D, H, W)
    spatial_map = token_sequence.view(B, H, W, D).permute(0, 3, 1, 2)
    return spatial_map

def main():
    config_path = os.path.join(base_dir, "backbone", "config.yaml")
    ckpt_path = os.path.join(base_dir, "backbone", "checkpoint.pt")
    
    cfg = OmegaConf.load(config_path)
    model = LunarBackbone(variant="base", modalities=["slope"], cfg=cfg, checkpoint_path=ckpt_path)
    model.eval()

    sample_path = os.path.join(base_dir, "data", "prospectivity_dataset", "patch_0007_0006_80N_SLOPE.tif")
    with rasterio.open(sample_path) as src:
        img = src.read(1)
        
    tensor_img = torch.from_numpy(img).float().unsqueeze(0).unsqueeze(0)
    
    print(f"Original image shape: {tensor_img.shape}")
    
    with torch.no_grad():
        outputs = model({"slope": tensor_img})
        
    native_last_layer = outputs[-1]
    print(f"Native output shape (last layer): {native_last_layer.shape}")
    
    # Experiment: Extract spatial feature map
    spatial_features = extract_spatial_features(native_last_layer)
    print(f"Selected representation shape (spatial map): {spatial_features.shape}")

if __name__ == '__main__':
    main()
