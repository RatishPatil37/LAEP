import os
import sys
import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
from torch.utils.data import DataLoader, TensorDataset, random_split

# Add base directory to path so we can import laep module
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(base_dir)

from laep.fusion.model import LAEPIceProspectivityModel

def main():
    print("=== LAEP Gated Fusion Validation ===")
    
    # 1. Load the Data
    dataset_path = os.path.join(base_dir, "data", "MASTER_FUSED_DATASET.csv")
    df = pd.read_csv(dataset_path).fillna(0.0)
    
    physical_cols = ['Incidence_Angle_deg_SAR', 'Reflectance_OHRC', 'Elevation_m_TMC2', 'Slope_deg_TMC2']
    nasa_cols = [f'Feature_{i}' for i in range(1, 257)]
    target_col = 'Hazard_Class_Code'
    
    X_phys = torch.tensor(df[physical_cols].values, dtype=torch.float32)
    X_nasa = torch.tensor(df[nasa_cols].values, dtype=torch.float32)
    Y = torch.tensor(df[target_col].values, dtype=torch.long)
    
    # 2. Train / Validation Split (80% Train, 20% Validate)
    dataset = TensorDataset(X_phys, X_nasa, Y)
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
    
    print(f"Training on {train_size} samples.")
    print(f"Validating on {val_size} unseen samples...\n")
    
    # 3. Setup Model & Compute Class Weights for Imbalanced Dataset
    num_classes = len(df[target_col].unique())
    model = LAEPIceProspectivityModel(num_physical_features=len(physical_cols), num_classes=num_classes)
    
    # Calculate inverse class frequencies to penalize the majority class (Safe_Flat/0)
    # and boost the minority class (Shadowing_Obscuration/1)
    class_counts = df[target_col].value_counts().sort_index().values
    class_weights = 1.0 / torch.tensor(class_counts, dtype=torch.float32)
    class_weights = class_weights / class_weights.sum() # Normalize
    
    print(f"Computed Class Weights to handle Imbalance: {class_weights.tolist()}")
    
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    # 4. Train the Model rigorously (15 Epochs)
    model.train()
    epochs = 15
    for epoch in range(epochs):
        for b_phys, b_nasa, b_target in train_loader:
            optimizer.zero_grad()
            predictions = model(b_phys, b_nasa)
            loss = criterion(predictions, b_target)
            loss.backward()
            optimizer.step()
        print(f"Epoch {epoch+1}/{epochs} Completed. (Loss: {loss.item():.4f})")
            
    # 5. VALIDATION PHASE (The Ultimate Test)
    print("\n--- Running Validation on Unseen Data ---")
    model.eval() # Put model in testing mode (turns off dropout)
    
    correct_predictions = 0
    total_samples = 0
    
    # We use torch.no_grad() because we aren't training anymore, just testing!
    with torch.no_grad():
        for b_phys, b_nasa, b_target in val_loader:
            # Get the model's raw output scores
            logits = model(b_phys, b_nasa)
            
            # The network's final answer is the class with the highest score
            predicted_classes = torch.argmax(logits, dim=1)
            
            # Count how many it got exactly right
            correct_predictions += (predicted_classes == b_target).sum().item()
            total_samples += b_target.size(0)
            
    # Calculate Final Accuracy Percentage
    accuracy = (correct_predictions / total_samples) * 100
    
    print(f"Total Validation Samples Checked: {total_samples}")
    print(f"Correct Predictions: {correct_predictions}")
    print(f"\n=> FINAL MODEL ACCURACY: {accuracy:.2f}%")
    
    # 6. SAVE THE TRAINED MODEL FOR INFERENCE
    model_save_path = os.path.join(base_dir, "data", "trained_ice_model.pt")
    torch.save(model.state_dict(), model_save_path)
    print(f"\nModel successfully saved to: {model_save_path}")
    print("Ready for Ice Prospectivity Inference!")
    
if __name__ == "__main__":
    main()
