from huggingface_hub import snapshot_download

# Download the complete repository files to a local directory
dataset_path = snapshot_download(
    repo_id="nasa-ibm-ai4science/Sombench-Ice-Prospectivity-Regression",
    repo_type="dataset",
    local_dir="./sombench_ice_prospectivity",
)

print(f"Downloaded to: {dataset_path}")