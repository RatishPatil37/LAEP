import torch
import torch.nn as nn
from typing import Dict, Any, Tuple
from omegaconf import OmegaConf

# Importing the actual NASA-IBM implementation
from terratorch_integration.lunar_backbone import LunarBackbone

class LFMEncoder(nn.Module):
    """
    Wrapper for the pretrained NASA-IBM Lunar Foundation Model.
    
    This loads the official ViT backbone and correctly parses its sequence output 
    into a regional spatial feature map without applying pooling.
    """
    def __init__(self, checkpoint_path: str, config_yaml_path: str, variant: str = "base", modality: str = "slope", device: str = "cpu"):
        super().__init__()
        cfg = OmegaConf.load(config_yaml_path)
        
        self.modality = modality
        self.device = torch.device(device)
        
        # Load the raw backbone
        self.backbone = LunarBackbone(
            variant=variant, 
            modalities=[modality], 
            cfg=cfg, 
            checkpoint_path=checkpoint_path
        )
        
        # Freeze backbone parameters
        for param in self.backbone.parameters():
            param.requires_grad = False
            
        self.backbone.eval()
        self.backbone.to(self.device)

    def extract_spatial_features(self, token_sequence: torch.Tensor) -> torch.Tensor:
        """
        Transforms the native (B, N, D) token sequence into a (B, D, H, W) spatial feature map.
        N = H * W. For a 256x256 input with 16x16 patches, N = 256, H = 16, W = 16.
        """
        B, N, D = token_sequence.shape
        H = W = int(N ** 0.5)
        # Reshape to spatial feature map (B, D, H, W)
        spatial_map = token_sequence.view(B, H, W, D).permute(0, 3, 1, 2)
        return spatial_map

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x (torch.Tensor): Tensor of shape (B, 1, H, W).
        Returns:
            torch.Tensor: Native LFM spatial feature map, e.g. shape (B, 768, 16, 16)
        """
        with torch.no_grad():
            outputs = self.backbone({self.modality: x})
        
        # We take the output of the final encoder block
        native_tokens = outputs[-1]
        return self.extract_spatial_features(native_tokens)
