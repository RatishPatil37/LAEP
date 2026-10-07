import torch
import torch.nn as nn
from typing import Tuple

class LAEPContextEncoder(nn.Module):
    """
    LAEP Context Encoder.
    
    Transforms the native NASA-IBM LFM spatial feature map (B, 768, 16, 16)
    into a dense 256-D LAEP context vector without losing spatial geometry 
    to simple mean-pooling.
    
    It uses a strided depth-reduction convolution to compress the spatial grid,
    followed by a flattening and the requested Linear projection MLP.
    """
    def __init__(
        self, 
        in_channels: int = 768, 
        spatial_size: int = 16,
        hidden_dim: int = 512, 
        out_dim: int = 256
    ):
        super().__init__()
        self.in_channels = in_channels
        self.out_dim = out_dim
        
        # Spatial compression layer: 
        # Reduces depth from 768 to 128 and halves spatial dimensions (16x16 -> 8x8)
        self.spatial_compression = nn.Sequential(
            nn.Conv2d(in_channels, 128, kernel_size=3, stride=2, padding=1),
            nn.BatchNorm2d(128),
            nn.GELU()
        )
        
        # Calculate flattened dimension
        reduced_spatial_size = spatial_size // 2
        flattened_dim = 128 * reduced_spatial_size * reduced_spatial_size
        
        # Projection MLP
        self.projection = nn.Sequential(
            nn.Linear(flattened_dim, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, out_dim)
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.
        
        Args:
            x (torch.Tensor): Native LFM spatial feature map of shape (B, C, H, W).
                              e.g., (B, 768, 16, 16)
                              
        Returns:
            torch.Tensor: LAEP context vector of shape (B, 256)
        """
        if x.dim() != 4:
            raise ValueError(f"Expected 4D input (B, C, H, W), got {x.dim()}D tensor.")
            
        # 1. Compress spatially (B, C, H, W) -> (B, 128, H/2, W/2)
        compressed = self.spatial_compression(x)
        
        # 2. Flatten -> (B, 128 * H/2 * W/2)
        flattened = compressed.flatten(1)
        
        # 3. Project -> (B, 256)
        out = self.projection(flattened)
        return out

    def save(self, path: str):
        """Save the encoder weights."""
        torch.save(self.state_dict(), path)
        
    def load(self, path: str, device: torch.device = None):
        """Load the encoder weights."""
        self.load_state_dict(torch.load(path, map_location=device))

