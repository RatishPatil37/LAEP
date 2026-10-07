import os
import shutil
from huggingface_hub import snapshot_download

# Define paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKBONE_DIR = os.path.join(BASE_DIR, "backbone")
DATA_DIR = os.path.join(BASE_DIR, "data", "prospectivity_dataset")

os.makedirs(BACKBONE_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

print("Downloading LFM backbone config and weights...")
# Download backbone
snapshot_download(
    repo_id="nasa-ibm-ai4science/NASA-IBM-Lunar-Foundation-Model",
    allow_patterns="backbone/*",
    local_dir=BASE_DIR
)

print("Downloading small sample of SomBench Ice Prospectivity dataset...")
# Download small dataset sample
snapshot_download(
    repo_id="nasa-ibm-ai4science/Sombench-Ice-Prospectivity-Regression",
    repo_type="dataset",
    allow_patterns=["*patch_0007_0006*.tif", "*.txt"],
    local_dir=DATA_DIR
)

print("Download complete.")
print("Verifying files...")

def verify_dir(path):
    total_size = 0
    for root, dirs, files in os.walk(path):
        for file in files:
            file_path = os.path.join(root, file)
            size = os.path.getsize(file_path)
            total_size += size
            print(f" - {os.path.relpath(file_path, BASE_DIR)} ({size / (1024*1024):.2f} MB)")
    print(f"Total size: {total_size / (1024*1024):.2f} MB\n")

print("\n--- Backbone ---")
verify_dir(BACKBONE_DIR)

print("--- Data Sample ---")
verify_dir(DATA_DIR)
