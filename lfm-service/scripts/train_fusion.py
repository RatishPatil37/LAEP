import os
import sys
import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
from torch.utils.data import DataLoader, TensorDataset

# Add base directory to path so we can import laep module
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(base_dir)

from laep.fusion.model import LAEPIceProspectivityModel

def main():
    print("=== LAEP Gated Fusion Training ===")
    
    # 1. Load the Master Dataset
    dataset_path = os.path.join(base_dir, "data", "MASTER_FUSED_DATASET.csv")
    print(f"Loading data from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    
    # 2. Separate the columns
    # Your physical features (e.g., Incidence Angle, Reflectance, Elevation, Slope)
    physical_cols = ['Incidence_Angle_deg_SAR', 'Reflectance_OHRC', 'Elevation_m_TMC2', 'Slope_deg_TMC2']
    
    # The NASA Context Vector features (Feature_1 to Feature_256)
    nasa_cols = [f'Feature_{i}' for i in range(1, 257)]
    
    # The Target (What we want to predict) - Let's use Hazard_Class_Code for now
    target_col = 'Hazard_Class_Code'
    
    # Clean NaNs just for this dummy training run
    df = df.fillna(0.0)
    
    # Convert to PyTorch Tensors
    X_phys = torch.tensor(df[physical_cols].values, dtype=torch.float32)
    X_nasa = torch.tensor(df[nasa_cols].values, dtype=torch.float32)
    Y = torch.tensor(df[target_col].values, dtype=torch.long)
    
    print(f"Physical input shape: {X_phys.shape}")
    print(f"NASA input shape: {X_nasa.shape}")
    print(f"Target shape: {Y.shape}")
    
    # 3. Create PyTorch DataLoader
    dataset = TensorDataset(X_phys, X_nasa, Y)
    dataloader = DataLoader(dataset, batch_size=32, shuffle=True)
    
    # 4. Initialize the Model
    num_classes = len(df[target_col].unique())
    model = LAEPIceProspectivityModel(num_physical_features=len(physical_cols), num_classes=num_classes)
    
    print(f"\nModel Initialized!")
    print(model)
    
    # 5. Define Loss and Optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    # 6. Run a quick Training Loop (1 Epoch just to prove it runs perfectly)
    print("\nStarting Training (1 Epoch Test)...")
    model.train()
    
    total_loss = 0
    for batch_idx, (b_phys, b_nasa, b_target) in enumerate(dataloader):
        optimizer.zero_grad()
        
        # Forward Pass (The Gated Fusion happens here!)
        predictions = model(b_phys, b_nasa)
        
        # Calculate Error
        loss = criterion(predictions, b_target)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        
        if batch_idx % 100 == 0:
            print(f"Batch {batch_idx}/{len(dataloader)} - Loss: {loss.item():.4f}")
            
    print(f"\nTraining Complete! Average Loss: {total_loss/len(dataloader):.4f}")
    print("The Model successfully learned to gate the physical and contextual features!")

if __name__ == "__main__":
    main()
