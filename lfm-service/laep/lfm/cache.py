import os
import json
import hashlib
import time
import torch
from typing import Dict, Any, Optional, Tuple

class LAEPEmbeddingCache:
    """
    Two-level embedding cache for LAEP:
    1. Native LFM Representation (e.g., 768x16x16 spatial feature maps)
    2. Final LAEP Context Vector (e.g., 256-D)
    
    Persists tensors alongside rich scientific metadata.
    """
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.native_dir = os.path.join(base_dir, "lfm_cache", "native")
        self.context_dir = os.path.join(base_dir, "lfm_cache", "context_256")
        
        os.makedirs(self.native_dir, exist_ok=True)
        os.makedirs(self.context_dir, exist_ok=True)
        
    def _generate_cache_filename(self, metadata: Dict[str, Any]) -> str:
        """
        Generates a deterministic filename based on core identifiers.
        """
        # Core keys that define uniqueness for the cache
        core_id = f"{metadata.get('sample_id', 'unknown')}_{metadata.get('modality', 'unknown')}"
        
        # We hash the config strings to detect configuration changes
        config_str = f"{metadata.get('model_checkpoint', '')}_{metadata.get('config_id', '')}"
        config_hash = hashlib.md5(config_str.encode()).hexdigest()[:8]
        
        return f"{core_id}_{config_hash}.pt"
        
    def _save_embedding(self, directory: str, tensor: torch.Tensor, metadata: Dict[str, Any]):
        """Internal helper to save tensor and metadata together."""
        metadata['timestamp'] = time.time()
        metadata['tensor_shape'] = list(tensor.shape)
        metadata['tensor_dtype'] = str(tensor.dtype)
        
        filename = self._generate_cache_filename(metadata)
        filepath = os.path.join(directory, filename)
        
        payload = {
            "metadata": metadata,
            "tensor": tensor.cpu()
        }
        torch.save(payload, filepath)
        return filepath
        
    def _load_embedding(self, directory: str, metadata: Dict[str, Any]) -> Optional[Tuple[torch.Tensor, Dict[str, Any]]]:
        """Internal helper to load tensor and metadata if exists."""
        filename = self._generate_cache_filename(metadata)
        filepath = os.path.join(directory, filename)
        
        if os.path.exists(filepath):
            payload = torch.load(filepath, map_location="cpu")
            return payload["tensor"], payload["metadata"]
        return None

    # --- Native LFM Cache ---
    
    def save_native(self, tensor: torch.Tensor, metadata: Dict[str, Any]) -> str:
        return self._save_embedding(self.native_dir, tensor, metadata)
        
    def load_native(self, metadata: Dict[str, Any]) -> Optional[Tuple[torch.Tensor, Dict[str, Any]]]:
        return self._load_embedding(self.native_dir, metadata)
        
    # --- LAEP 256-D Context Cache ---
    
    def save_context(self, tensor: torch.Tensor, metadata: Dict[str, Any]) -> str:
        return self._save_embedding(self.context_dir, tensor, metadata)
        
    def load_context(self, metadata: Dict[str, Any]) -> Optional[Tuple[torch.Tensor, Dict[str, Any]]]:
        return self._load_embedding(self.context_dir, metadata)

