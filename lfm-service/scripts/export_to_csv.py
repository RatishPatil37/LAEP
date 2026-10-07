import os
import torch
import numpy as np

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pt_path = os.path.join(base_dir, "data", "south_pole_training_dataset.pt")
    csv_path = os.path.join(base_dir, "data", "south_pole_training_dataset.csv")
    
    print(f"Loading binary dataset from: {pt_path}")
    dataset = torch.load(pt_path)
    
    # Convert PyTorch tensor to Numpy array
    numpy_array = dataset.detach().cpu().numpy()
    
    print(f"Exporting array of shape {numpy_array.shape} to CSV...")
    
    # Let's create a header row: Feature_1, Feature_2, ..., Feature_256
    header = ",".join([f"Feature_{i+1}" for i in range(numpy_array.shape[1])])
    
    # Save as CSV
    np.savetxt(csv_path, numpy_array, delimiter=",", header=header, comments="", fmt="%.6f")
    
    print(f"\nSuccess! Dataset cleanly exported to:")
    print(csv_path)

if __name__ == "__main__":
    main()
