import torch
import torch.nn as nn
import torch.nn.functional as F

class PhysicalEncoder(nn.Module):
    """Encodes Chandrayaan-2 tabular physical features into a dense vector."""
    def __init__(self, input_dim, output_dim=256):
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.LayerNorm(128),
            nn.GELU(),
            nn.Dropout(0.2),
            nn.Linear(128, output_dim),
            nn.LayerNorm(output_dim)
        )

    def forward(self, x):
        return self.mlp(x)

class GatedFusion(nn.Module):
    """Fuses the NASA-IBM Context Vector with the Chandrayaan-2 Physical Vector using a learned gate."""
    def __init__(self, feature_dim=256):
        super().__init__()
        # The gate network looks at BOTH vectors to decide the trust percentage (0.0 to 1.0)
        self.gate_network = nn.Sequential(
            nn.Linear(feature_dim * 2, 64),
            nn.GELU(),
            nn.Linear(64, feature_dim),
            nn.Sigmoid()  # Forces the output to be exactly between 0 and 1
        )

    def forward(self, e_context, e_phys):
        # 1. Combine them to let the network analyze the conflict
        combined = torch.cat([e_context, e_phys], dim=-1)
        
        # 2. Calculate the gate percentage 'g'
        g = self.gate_network(combined)
        
        # 3. Fuse them: (g * Context) + ((1 - g) * Physical)
        z_fused = (g * e_context) + ((1 - g) * e_phys)
        return z_fused

class LAEPIceProspectivityModel(nn.Module):
    """The final end-to-end model for Ice Prediction."""
    def __init__(self, num_physical_features, num_classes=3):
        super().__init__()
        
        # Branch 1: The NASA vector is already 256-D, so it doesn't need an encoder here.
        # Branch 2: Physical features need to be encoded to 256-D
        self.physical_encoder = PhysicalEncoder(input_dim=num_physical_features, output_dim=256)
        
        # The Mixer
        self.fusion_layer = GatedFusion(feature_dim=256)
        
        # The Output Head (Predicts the final Ice Score / Hazard Class)
        self.prediction_head = nn.Sequential(
            nn.Linear(256, 64),
            nn.GELU(),
            nn.Dropout(0.2),
            nn.Linear(64, num_classes) # For example, predicting 3 Hazard Classes
        )

    def forward(self, physical_features, nasa_context):
        # 1. Encode Chandrayaan-2 data
        e_phys = self.physical_encoder(physical_features)
        
        # 2. Fuse with NASA data
        z_fused = self.fusion_layer(e_context=nasa_context, e_phys=e_phys)
        
        # 3. Final Prediction
        logits = self.prediction_head(z_fused)
        return logits
