import os
import sys
import torch
import rasterio
from omegaconf import OmegaConf

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(base_dir, "NASA-IBM-Lunar-Foundation-Model"))
sys.path.append(base_dir) # To allow importing laep

from terratorch_integration.lunar_backbone import LunarBackbone
from laep.lfm.encoder import LAEPContextEncoder

def extract_spatial_features(token_sequence):
    B, N, D = token_sequence.shape
    H = W = int(N ** 0.5)
    spatial_map = token_sequence.view(B, H, W, D).permute(0, 3, 1, 2)
    return spatial_map

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    print("=== Testing LAEP Context Encoder ===")
    
    # 1. Test with synthetic tensor
    print("\n[1] Synthetic Tensor Test")
    B, C, H, W = 2, 768, 16, 16
    synthetic_input = torch.randn(B, C, H, W).to(device)
    
    encoder = LAEPContextEncoder(in_channels=C, spatial_size=H).to(device)
    output = encoder(synthetic_input)
    
    print(f"Synthetic Input shape: {synthetic_input.shape}")
    print(f"Synthetic Output shape: {output.shape}")
    assert output.shape == (B, 256), f"Expected (B, 256), got {output.shape}"
    print("Synthetic shape validation PASSED.")
    
    # 2. Test with real NASA-IBM LFM Output
    print("\n[2] Real LFM Sample Test")
    
    config_path = os.path.join(base_dir, "backbone", "config.yaml")
    ckpt_path = os.path.join(base_dir, "backbone", "checkpoint.pt")
    cfg = OmegaConf.load(config_path)
    
    print("Loading LFM Backbone...")
    # Freeze the backbone as requested
    lfm_backbone = LunarBackbone(variant="base", modalities=["slope"], cfg=cfg, checkpoint_path=ckpt_path)
    for param in lfm_backbone.parameters():
        param.requires_grad = False
    lfm_backbone.eval()
    lfm_backbone.to(device)
    print("LFM Backbone loaded and frozen.")

    sample_path = os.path.join(base_dir, "data", "prospectivity_dataset", "patch_0007_0006_80N_SLOPE.tif")
    with rasterio.open(sample_path) as src:
        img = src.read(1)
        
    tensor_img = torch.from_numpy(img).float().unsqueeze(0).unsqueeze(0).to(device)
    
    # Run through LFM
    print("Extracting features from LFM...")
    with torch.no_grad():
        lfm_outputs = lfm_backbone({"slope": tensor_img})
        
    native_tokens = lfm_outputs[-1]
    spatial_features = extract_spatial_features(native_tokens)
    print(f"Verified Spatial Feature Map shape: {spatial_features.shape}")
    
    # Pass through LAEP Context Encoder
    print("Passing through LAEP Context Encoder...")
    laep_context_vector = encoder(spatial_features)
    
    print(f"Final LAEP Context Vector shape: {laep_context_vector.shape}")
    print(f"Final LAEP Context Vector dtype: {laep_context_vector.dtype}")
    
    assert laep_context_vector.shape == (1, 256), "Failed to produce 256-D vector!"
    print("Real sample validation PASSED. Successfully bridged LFM -> LAEP interface.")
    
    # 3. Test Save/Load
    print("\n[3] IO Test")
    encoder.save("laep_context_encoder.pt")
    new_encoder = LAEPContextEncoder().to(device)
    new_encoder.load("laep_context_encoder.pt", device=device)
    print("Save/Load validation PASSED.")
    
if __name__ == '__main__':
    main()
