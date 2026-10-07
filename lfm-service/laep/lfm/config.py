import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class LFMConfig:
    """
    Configuration parameters for the LAEP NASA-IBM LFM Pipeline.
    """
    # Base paths
    backbone_dir: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "backbone")
    cache_dir: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
    
    # Checkpoint details
    checkpoint_path: str = os.path.join(backbone_dir, "checkpoint.pt")
    config_yaml_path: str = os.path.join(backbone_dir, "config.yaml")
    
    # Model parameters
    variant: str = "base"
    modality: str = "slope"
    
    # Encoder parameters
    out_dim: int = 256
    
    # Hardware
    device: Optional[str] = None # Will default to cuda if available else cpu
