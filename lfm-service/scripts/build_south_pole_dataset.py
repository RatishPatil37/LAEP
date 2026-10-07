import os
import sys
import torch
import rasterio
from huggingface_hub import snapshot_download

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(base_dir, "NASA-IBM-Lunar-Foundation-Model"))
sys.path.append(base_dir)

from laep.lfm import LAEPLunarPipeline

def download_south_pole_samples(data_dir):
    print("Downloading all South Pole SLOPE samples from Hugging Face...")
    snapshot_download(
        repo_id="nasa-ibm-ai4science/Sombench-Ice-Prospectivity-Regression",
        repo_type="dataset",
        allow_patterns=["*_S_*_SLOPE.tif"],
        local_dir=data_dir
    )
    print("Download complete!\n")

def main():
    print("=== LAEP South Pole Dataset Builder ===")
    
    data_dir = os.path.join(base_dir, "data", "prospectivity_dataset")
    os.makedirs(data_dir, exist_ok=True)
    
    # 1. Download all South Pole slope patches (81 files)
    download_south_pole_samples(data_dir)
    
    # 2. Get list of all South Pole slope files
    all_files = os.listdir(data_dir)
    south_pole_files = [f for f in all_files if "_S_" in f and "SLOPE.tif" in f]
    south_pole_files.sort()
    
    print(f"Found {len(south_pole_files)} South Pole samples to process.")
    
    # 3. Initialize LAEP Pipeline
    print("\nInitializing LAEP LFM Pipeline...")
    pipeline = LAEPLunarPipeline()
    
    # 4. Process all samples
    all_embeddings = []
    
    print("\nExtracting 256-D Context Vectors...")
    for i, filename in enumerate(south_pole_files):
        print(f"[{i+1}/{len(south_pole_files)}] Processing {filename}...")
        
        path = os.path.join(data_dir, filename)
        with rasterio.open(path) as src:
            img = src.read(1)
            
        sample_tensor = torch.from_numpy(img).float().unsqueeze(0).unsqueeze(0)
        
        metadata = {
            "sample_id": filename.replace(".tif", ""),
            "dataset": "sombench_ice_prospectivity",
            "spatial_coordinates": "South_Pole",
            "modality": "slope",
            "model_checkpoint": "NASA_IBM_LFM_base",
            "config_id": "v1"
        }
        
        # This will either run the LFM or instantly load from cache!
        context_vector = pipeline.get_lfm_context(sample_tensor, metadata)
        all_embeddings.append(context_vector)
        
    print("\n=== Processing Complete ===")
    
    # Stack all embeddings into a single dataset tensor (81, 256)
    dataset_tensor = torch.cat(all_embeddings, dim=0)
    print(f"Final Dataset Tensor Shape: {dataset_tensor.shape}")
    
    # Save the ready-to-train dataset
    dataset_path = os.path.join(base_dir, "data", "south_pole_training_dataset.pt")
    torch.save(dataset_tensor, dataset_path)
    print(f"Saved ready-to-train embeddings to: {dataset_path}")
    print("\nThe South Pole dataset is now fully extracted, cached, and ready for downstream ice-classifier training!")

if __name__ == '__main__':
    main()
