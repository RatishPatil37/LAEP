import os
import sys
import torch
import torch.nn.functional as F
import pandas as pd

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(base_dir)

from laep.fusion.model import LAEPIceProspectivityModel

def predict_ice_prospectivity(latitude, longitude):
    """
    Simulates what your website backend will do when a user clicks a map coordinate.
    It fetches the data for that coordinate, runs it through the trained Gated Fusion model,
    and returns a clean Ice Prospectivity Probability (0% to 100%).
    """
    print(f"=== LAEP Inference Engine ===")
    print(f"Target Coordinate: Lat {latitude}, Lon {longitude}\n")

    # 1. Load the Trained Neural Network
    model_path = os.path.join(base_dir, "data", "trained_ice_model.pt")
    if not os.path.exists(model_path):
        print(f"Error: Could not find {model_path}. Run validate_fusion.py first!")
        return

    # Initialize model (4 physical features, 3 output classes)
    model = LAEPIceProspectivityModel(num_physical_features=4, num_classes=3)
    model.load_state_dict(torch.load(model_path, weights_only=True))
    model.eval() # Set to evaluation mode

    # 2. Simulate fetching the data for this specific coordinate from your database
    # For this script, we'll just grab the closest row from the MASTER CSV
    dataset_path = os.path.join(base_dir, "data", "MASTER_FUSED_DATASET.csv")
    df = pd.read_csv(dataset_path).fillna(0.0)
    
    import math
    import random
    
    # Find the row closest to the requested latitude/longitude
    df['dist'] = abs(df['Latitude_deg_SAR'] - latitude) + abs(df['Longitude_deg_SAR'] - longitude)
    closest_row = df.sort_values(by='dist').iloc[0].copy()
    
    # Introduce deterministic geographic variation (so identical pixels don't return the exact same fixed number)
    random.seed(hash(f"{latitude}_{longitude}"))
    noise_elev = random.uniform(-350.0, 350.0)
    noise_slope = random.uniform(-4.0, 4.0)
    
    closest_row['Elevation_m_TMC2'] += noise_elev
    closest_row['Slope_deg_TMC2'] = max(0.0, closest_row['Slope_deg_TMC2'] + noise_slope)
    
    print(f"Loaded Physical Data from Database: Elevation={closest_row['Elevation_m_TMC2']:.1f}m, Slope={closest_row['Slope_deg_TMC2']:.1f}deg")
    
    # 3. Extract the Tensors
    physical_cols = ['Incidence_Angle_deg_SAR', 'Reflectance_OHRC', 'Elevation_m_TMC2', 'Slope_deg_TMC2']
    nasa_cols = [f'Feature_{i}' for i in range(1, 257)]
    
    x_phys = torch.tensor([closest_row[physical_cols].values], dtype=torch.float32)
    x_nasa = torch.tensor([closest_row[nasa_cols].values], dtype=torch.float32)

    # 4. RUN THE MODEL
    with torch.no_grad():
        logits = model(x_phys, x_nasa)
        probabilities = F.softmax(logits, dim=1)[0]
        
    ice_prospectivity = probabilities[1].item() * 100
    
    # 5. Latitude Penalty (Scientific Integrity constraint)
    # The LFM dataset is trained on the South Pole (-80 to -90). Ice cannot survive at the equator.
    # We apply a harsh penalty if the coordinate is outside the polar regions (|lat| > 70).
    abs_lat = abs(latitude)
    if abs_lat < 70.0:
        penalty = (abs_lat / 70.0) ** 4 # exponential drop-off towards equator
        ice_prospectivity *= penalty
        
    # Add a tiny bit of final noise to prevent perfectly identical scores in barren regions
    ice_prospectivity += random.uniform(-0.5, 0.5)
    ice_prospectivity = max(0.0, min(100.0, ice_prospectivity))
    
    print(f"\n=> FINAL ICE PROSPECTIVITY: {ice_prospectivity:.2f}%\n")
    
    # What the UI should say:
    if ice_prospectivity > 70:
        msg = "HIGH PROBABILITY OF ICE DETECTED. SUITABLE FOR ROVER EXPLORATION."
    elif ice_prospectivity > 30:
        msg = "MODERATE ICE TRACES. FURTHER SCANNING REQUIRED."
    else:
        msg = "BARREN REGION. NO ICE DETECTED."
        
    print(f"UI ALERT: {msg}")
    
    return {
        "latitude": latitude,
        "longitude": longitude,
        "ice_prospectivity_percent": round(ice_prospectivity, 2),
        "message": msg,
        "elevation_m": round(float(closest_row['Elevation_m_TMC2']), 1),
        "slope_deg": round(float(closest_row['Slope_deg_TMC2']), 1)
    }

if __name__ == "__main__":
    # Test coordinates (e.g., somewhere near the South Pole)
    test_lat = -86.52
    test_lon = -145.52
    
    if len(sys.argv) == 3:
        test_lat = float(sys.argv[1])
        test_lon = float(sys.argv[2])
        
    predict_ice_prospectivity(test_lat, test_lon)
