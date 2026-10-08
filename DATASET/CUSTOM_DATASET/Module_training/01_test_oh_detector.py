import json
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix

# 1. Load Feature Manifest and Model
with open('Module_training/ml_results/models/feature_manifest.json', 'r') as f:
    manifest = json.load(f)

feature_cols = manifest['features']
model = joblib.load('Module_training/ml_results/models/xgb_oh_detector_model.joblib')

print("Loaded Model and Feature Manifest successfully.")
print(f"Features expected ({len(feature_cols)}): {feature_cols}\n")

# ---------------------------------------------------------------------------
# Test Case 1: Batch Evaluation on Test Dataset
# ---------------------------------------------------------------------------
df = pd.read_csv('Module_training\F2_ml_ready_dataset.csv')

X = df[feature_cols]
y_true = df['IIRS_OH_Detection_State']

# Map target values to model class indices (0, 1, 2)
target_to_idx = {v: int(k) for k, v in manifest['target_mapping'].items()}
idx_to_target = {int(k): v for k, v in manifest['target_mapping'].items()}
y_true_mapped = y_true.map(target_to_idx)

# Predict
y_pred_idx = model.predict(X)
y_pred_target = [idx_to_target[p] for p in y_pred_idx]

print("=== Batch Evaluation Metrics ===")
print(classification_report(y_true, y_pred_target, digits=4))

# ---------------------------------------------------------------------------
# Test Case 2: Individual Simulated Telemetry Points
# ---------------------------------------------------------------------------
sample_telemetry = pd.DataFrame([
    # Sample A: PSR / Shadowed Region (IIRS Unavailable -> -1)
    {
        "Latitude_deg_SAR": -86.5188, "Longitude_deg_SAR": -145.7955,
        "Incidence_Angle_deg_SAR": 23.93, "Ground_Range_m_SAR": 37113.22,
        "Slant_Range_m_SAR": 94385.22, "Reflectance_OHRC": 0.1653,
        "Elevation_m_TMC2": -1839.0, "Slope_deg_TMC2": 0.9,
        "IIRS_Data_Available": 0, "Reflectance_IIRS_1500nm": -1.0,
        "Reflectance_IIRS_2000nm": -9999.0, "IIRS_Band_Ratio": -9999.0,
        "IIRS_H2O_Absorption_Depth": -9999.0
    },
    # Sample B: Dry Lunar Regolith (IIRS Available, zero absorption -> 0)
    {
        "Latitude_deg_SAR": -82.1200, "Longitude_deg_SAR": 45.3100,
        "Incidence_Angle_deg_SAR": 41.20, "Ground_Range_m_SAR": 42100.00,
        "Slant_Range_m_SAR": 88400.00, "Reflectance_OHRC": 0.2100,
        "Elevation_m_TMC2": -1200.0, "Slope_deg_TMC2": 3.2,
        "IIRS_Data_Available": 1, "Reflectance_IIRS_1500nm": 0.2450,
        "Reflectance_IIRS_2000nm": 0.2610, "IIRS_Band_Ratio": 1.065,
        "IIRS_H2O_Absorption_Depth": 0.008
    },
    # Sample C: Water Ice / OH Abundance (High 3000nm/2000nm absorption -> 1)
    {
        "Latitude_deg_SAR": -89.4100, "Longitude_deg_SAR": 120.8500,
        "Incidence_Angle_deg_SAR": 68.50, "Ground_Range_m_SAR": 51200.00,
        "Slant_Range_m_SAR": 102300.00, "Reflectance_OHRC": 0.0950,
        "Elevation_m_TMC2": -3850.0, "Slope_deg_TMC2": 14.8,
        "IIRS_Data_Available": 1, "Reflectance_IIRS_1500nm": 0.1120,
        "Reflectance_IIRS_2000nm": 0.0840, "IIRS_Band_Ratio": 1.780,
        "IIRS_H2O_Absorption_Depth": 0.225
    }
])

# Ensure exact column ordering
sample_X = sample_telemetry[feature_cols]

# Predict class and probabilities
predictions_idx = model.predict(sample_X)
probabilities = model.predict_proba(sample_X)

label_names = { -1: "Unobserved/PSR (-1)", 0: "Dry Regolith (0)", 1: "OH/H2O Present (1)" }

print("\n=== Real-Time Inference Results ===")
for i, pred_idx in enumerate(predictions_idx):
    predicted_state = idx_to_target[pred_idx]
    confidence = np.max(probabilities[i]) * 100
    print(f"Sample {i+1}: Predicted Class = {label_names[predicted_state]} (Confidence: {confidence:.2f}%)")4r