import torch
from typing import Dict, Any, Optional

from .config import LFMConfig
from .core import LFMEncoder
from .encoder import LAEPContextEncoder
from .cache import LAEPEmbeddingCache

class LAEPLunarPipeline:
    """
    Unified conceptual API for processing lunar spatial inputs into LAEP 256-D context vectors.
    """
    def __init__(self, config: Optional[LFMConfig] = None):
        if config is None:
            self.config = LFMConfig()
        else:
            self.config = config
            
        device_str = self.config.device if self.config.device else ("cuda" if torch.cuda.is_available() else "cpu")
        self.device = torch.device(device_str)
        
        # Initialize the cache layer
        self.cache = LAEPEmbeddingCache(base_dir=self.config.cache_dir)
        
        # We will lazy-load the heavy models only when a cache miss occurs
        self.lfm_encoder: Optional[LFMEncoder] = None
        self.context_encoder: Optional[LAEPContextEncoder] = None

    def _load_models(self):
        """Lazy load the models to save memory if dealing entirely with cache hits."""
        if self.lfm_encoder is None:
            self.lfm_encoder = LFMEncoder(
                checkpoint_path=self.config.checkpoint_path,
                config_yaml_path=self.config.config_yaml_path,
                variant=self.config.variant,
                modality=self.config.modality,
                device=str(self.device)
            )
            
        if self.context_encoder is None:
            self.context_encoder = LAEPContextEncoder(out_dim=self.config.out_dim)
            self.context_encoder.eval()
            self.context_encoder.to(self.device)

    def get_lfm_context(self, spatial_sample: torch.Tensor, metadata: Dict[str, Any]) -> torch.Tensor:
        """
        Processes an input spatial sample to produce the LAEP 256-D context vector.
        
        Args:
            spatial_sample (torch.Tensor): Input batch (B, 1, H, W)
            metadata (Dict[str, Any]): Dictionary describing the sample (e.g. sample_id, modality)
            
        Returns:
            torch.Tensor: The final LAEP Context Vector (B, 256)
        """
        # Step 1: Check Level 2 Cache (Final 256-D Vector)
        cached_context = self.cache.load_context(metadata)
        if cached_context is not None:
            return cached_context[0].to(self.device)
            
        # Step 2: Check Level 1 Cache (Native Spatial Feature Map)
        cached_native = self.cache.load_native(metadata)
        
        if cached_native is not None:
            native_features = cached_native[0].to(self.device)
        else:
            # Cache MISS on Native: Execute LFM Backbone
            self._load_models()
            spatial_sample = spatial_sample.to(self.device)
            native_features = self.lfm_encoder(spatial_sample)
            
            # Save Native Representation to cache
            self.cache.save_native(native_features, metadata)
            
        # Step 3: We have Native Features, but missed Context. Execute LAEP Context Encoder
        self._load_models()
        context_vector = self.context_encoder(native_features)
        
        # Save Context Vector to cache
        self.cache.save_context(context_vector, metadata)
        
        return context_vector
