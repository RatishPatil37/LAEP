import os
import sys
import torch
import rasterio

# Ensure paths are set correctly for running inside lfm-service
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(base_dir, "NASA-IBM-Lunar-Foundation-Model"))
sys.path.append(base_dir)

from laep.lfm import LAEPLunarPipeline

def main():
    print("=== LAEP LFM Inference Example ===\n")
    
    # 1. Initialize Pipeline
    print("Initializing pipeline...")
    pipeline = LAEPLunarPipeline()
    
    # 2. Load Sample Image
    sample_filename = "patch_0007_0006_80N_SLOPE.tif"
    sample_path = os.path.join(base_dir, "data", "prospectivity_dataset", sample_filename)
    
    print(f"Loading input sample: {sample_path}")
    with rasterio.open(sample_path) as src:
        img = src.read(1)
        
    sample_tensor = torch.from_numpy(img).float().unsqueeze(0).unsqueeze(0)
    
    # 3. Define Metadata for Caching
    metadata = {
        "sample_id": sample_filename.replace(".tif", ""),
        "dataset": "sombench_ice_prospectivity",
        "spatial_coordinates": "80N",
        "modality": "slope",
        "model_checkpoint": "NASA_IBM_LFM_base_v1",
        "config_id": "pretrain_config_v1"
    }
    
    # 4. Run Pipeline (get_lfm_context)
    print("\nExecuting Pipeline (get_lfm_context)...")
    context_vector = pipeline.get_lfm_context(sample_tensor, metadata)
    
    # 5. Output
    print("\n=== Result ===")
    print(f"LAEP Interface Context Vector Shape: {context_vector.shape}")
    print(f"Vector Preview (first 5 dims): {context_vector[0, :5].tolist()}")
    print("\nNote: Re-running this script will hit the Cache instantly without executing the Foundation Model.")

if __name__ == '__main__':
    main()
