# LAEP NASA-IBM LFM Branch Integration

This module cleanly packages the official NASA-IBM Lunar Foundation Model (LFM) as a decoupled, caching-enabled microservice inside the LAEP architecture.

## Architectural Overview

The pipeline executes as follows:

```
INPUT: Lunar Spatial Sample (e.g., 256x256 DEM patch)
        ↓
[ NASA-IBM LFM Backbone ] (Frozen ViT representation)
        ↓
NATIVE REPRESENTATION: 768-D Spatial Feature Map (e.g., 768x16x16)
        ↓
[ Cache Level 1: Native ] 
        ↓
[ LAEP Context Encoder ] (Convolutional Reduction + MLP Projection)
        ↓
LAEP INTERFACE: 256-D Context Vector
        ↓
[ Cache Level 2: Context ] 
```

### Critical Distinctions
- **NASA-IBM LFM:** Provides the *pretrained spatial representation*. It inherently outputs a flat token sequence which we algorithmically map back into a dense 2D spatial feature map `(B, 768, H, W)`.
- **LAEP Context Encoder:** Provides our projection to 256-D without destroying the spatial geometry via naive mean-pooling. 
- **256-D Vector:** This is the **LAEP Interface**, *NOT* the native LFM dimension.

## Installation / Setup

1. **Environment:** Use Python >= 3.12. (Managed via `uv`).
2. **NASA-IBM Dependencies:**
   ```bash
   uv pip install torch rasterio omegaconf psutil
   # The LFM and terratorch_integration packages are resolved locally via git clone
   ```
3. **Weight Acquisition:** Ensure you have downloaded the official `checkpoint.pt` and `config.yaml` to the `lfm-service/backbone/` directory.

## Core API Usage

We expose a simple conceptual API via `LAEPLunarPipeline`:

```python
import torch
from laep.lfm import LAEPLunarPipeline

# 1. Initialize the caching pipeline
pipeline = LAEPLunarPipeline()

# 2. Prepare spatial sample (B, 1, H, W) and rich metadata
spatial_sample = torch.randn(1, 1, 256, 256)
metadata = {
    "sample_id": "crater_tycho_01",
    "modality": "slope",
    "model_checkpoint": "NASA_IBM_LFM_base",
    "config_id": "v1"
}

# 3. Retrieve the 256-D vector
# This automatically handles LFM execution, spatial extraction, LAEP Context Encoding, and 2-level caching!
context_256d = pipeline.get_lfm_context(spatial_sample, metadata)
```

## Available Components

- `LFMConfig`: Configuration interface (configurable paths, devices, dimensions).
- `LFMEncoder`: Wraps the heavy foundation model and natively handles spatial reshaping.
- `LAEPContextEncoder`: Reduces the spatial tensor via depth-reduction convs + MLP.
- `LAEPEmbeddingCache`: Handles fast disk persistence of metadata and PyTorch tensors.

## Validation & Testing

Run `scripts/validate_laep_pipeline.py` to end-to-end validate batch determinism, shape constraints (N,256), NaN checks, and memory profiling.
