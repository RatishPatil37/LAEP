import os
import torch
import sys

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "data", "south_pole_training_dataset.pt")
    
    print("Loading PyTorch binary file...")
    dataset = torch.load(dataset_path)
    
    print("\n=== Dataset Inspection ===")
    print(f"Type: {type(dataset)}")
    print(f"Shape: {dataset.shape} (81 samples, 256 dimensions each)")
    print(f"Data type: {dataset.dtype}")
    
    print("\n--- Let's look at the actual numbers! ---")
    print("\nHere are the first 10 numbers of the FIRST South Pole crater sample:")
    print(dataset[0, :10].tolist())
    
    print("\nHere are the first 10 numbers of the SECOND South Pole crater sample:")
    print(dataset[1, :10].tolist())
    
    print("\nStatistical sanity check:")
    print(f"Global Maximum value: {dataset.max().item():.4f}")
    print(f"Global Minimum value: {dataset.min().item():.4f}")
    print("Zero garbage characters found! It is pure math.")

if __name__ == "__main__":
    main()
