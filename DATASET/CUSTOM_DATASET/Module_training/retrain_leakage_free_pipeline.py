import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import shap
import xgboost as xgb
from sklearn.model_selection import GroupKFold
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, f1_score

# =============================================================================
# PHASE 1: Decouple Task Architecture & Filter Observations
# =============================================================================
print("[PHASE 1] Loading dataset and applying deterministic observation mask...")
df_raw = pd.read_csv('Module_training/F2_ml_ready_dataset.csv')

# Drop unobserved / PSR points (Class -1) to isolate valid surface measurements
df_valid = df_raw[df_raw['IIRS_Data_Available'] == 1].copy()

# Filter target to binary: 0 (Dry Regolith) vs 1 (OH/H2O Present)
df_valid = df_valid[df_valid['IIRS_OH_Detection_State'].isin([0, 1])].reset_index(drop=True)

print(f"Original dataset shape: {df_raw.shape}")
print(f"Valid surface observation shape: {df_valid.shape}")
print(f"Target distribution:\n{df_valid['IIRS_OH_Detection_State'].value_counts()}\n")

# =============================================================================
# PHASE 2 (Option B): Retain Raw Channels & Exclude Derivative Leakage Features
# =============================================================================
print("[PHASE 2] Defining feature matrix X using raw spectral and physical attributes...")

# Retain raw physical, topographical, SAR, and raw hyperspectral reflectance channels
feature_cols_option_b = [
    'Latitude_deg_SAR',
    'Longitude_deg_SAR',
    'Incidence_Angle_deg_SAR',
    'Ground_Range_m_SAR',
    'Slant_Range_m_SAR',
    'Reflectance_OHRC',
    'Elevation_m_TMC2',
    'Slope_deg_TMC2',
    'Reflectance_IIRS_1500nm',
    'Reflectance_IIRS_2000nm'
]

# Explicitly excluded leakage features:
# - IIRS_Data_Available (Used in Phase 1 mask)
# - IIRS_H2O_Absorption_Depth (Direct target annotation formula)
# - IIRS_Band_Ratio (Derived index used in labeling script)

X = df_valid[feature_cols_option_b].copy()
y = df_valid['IIRS_OH_Detection_State'].values

print(f"Selected Predictor Features ({len(feature_cols_option_b)}): {feature_cols_option_b}\n")

# =============================================================================
# PHASE 3: Spatial Block Cross-Validation (GroupKFold)
# =============================================================================
print("[PHASE 3] Generating spatial grid blocks (0.05° resolution) to prevent spatial leakage...")

# Assign spatial block IDs based on lat/lon coordinates (~1.5 km spatial blocks)
grid_size_deg = 0.05
df_valid['spatial_block'] = (
    (df_valid['Latitude_deg_SAR'] // grid_size_deg).astype(int).astype(str) + "_" +
    (df_valid['Longitude_deg_SAR'] // grid_size_deg).astype(int).astype(str)
)

groups = df_valid['spatial_block'].values
unique_blocks = np.unique(groups)
print(f"Total unique spatial blocks created: {len(unique_blocks)}")

gkf = GroupKFold(n_splits=5)

oof_preds = np.zeros(len(df_valid))
oof_probs = np.zeros(len(df_valid))

# Train-Validation Loop across Spatial Blocks
print("\n--- Starting 5-Fold Spatial Block Cross-Validation ---")
fold_f1_scores = []

for fold, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups)):
    X_train, y_train = X.iloc[train_idx], y[train_idx]
    X_val, y_val = X.iloc[val_idx], y[val_idx]
    
    # Train XGBoost model on spatial training blocks
    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric='logloss',
        n_jobs=-1
    )
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )
    
    val_probs = model.predict_proba(X_val)[:, 1]
    val_preds = (val_probs >= 0.5).astype(int)
    
    oof_probs[val_idx] = val_probs
    oof_preds[val_idx] = val_preds
    
    f1 = f1_score(y_val, val_preds, average='macro')
    fold_f1_scores.append(f1)
    print(f"Fold {fold + 1}: Val Macro F1 = {f1:.4f} (Train blocks: {len(np.unique(groups[train_idx]))}, Val blocks: {len(np.unique(groups[val_idx]))})")

print(f"\nOverall Out-of-Fold Spatial Macro F1: {f1_score(y, oof_preds, average='macro'):.4f}")
print(f"Overall Out-of-Fold ROC-AUC: {roc_auc_score(y, oof_probs):.4f}")
print("\nOut-of-Fold Classification Report:")
print(classification_report(y, oof_preds, target_names=['Dry Regolith (0)', 'OH/H2O Present (1)'], digits=4))

# Train final production model on full valid surface dataset and save
final_model = xgb.XGBClassifier(
    n_estimators=300, max_depth=5, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1
)
final_model.fit(X, y)

joblib.dump(final_model, 'Module_training/ml_results/models/xgb_oh_detector_model.joblib')

manifest = {
    "features": feature_cols_option_b,
    "target_mapping": {"0": 0, "1": 1},
    "spatial_grid_resolution_deg": grid_size_deg,
    "validation_type": "Spatial Block GroupKFold"
}
with open('feature_manifest_leakage_free.json', 'w') as f:
    json.dump(manifest, f, indent=2)

print("Saved leakage-free model to 'Module_training/ml_results/models/xgb_oh_detector_model.joblib'.\n")

# # =============================================================================
# # PHASE 4: Diagnostic SHAP & Physics Verification
# # =============================================================================
# print("[PHASE 4] Executing SHAP Attribution and Roughness Stress Test...")

# # 1. SHAP Feature Attribution Analysis
# explainer = shap.TreeExplainer(final_model)

# shap_values = explainer(X)

# plt.figure(figsize=(10, 6))
# shap.summary_plot(shap_values, X, show=False)
# plt.title("SHAP Feature Importance (Leakage-Free Option B)", fontsize=12)
# plt.tight_layout()
# plt.savefig("Module_training/ml_results/models/shap_summary_leakage_free.png", dpi=300)
# plt.close()
# print("Saved SHAP summary plot to 'Module_training/ml_results/models/shap_summary_leakage_free.png'.")

# # 2. Roughness & Slope Ambiguity Stress Test
# # Evaluate performance specifically on high-slope terrains (>10°) where SAR speckle and shadowing introduce ambiguity
# high_slope_mask = X['Slope_deg_TMC2'] > 10.0
# if high_slope_mask.sum() > 0:
#     y_high_slope = y[high_slope_mask]
#     preds_high_slope = oof_preds[high_slope_mask]
    
#     print(f"\n--- Stress Test: High-Slope / Rough Terrain (>10°, N={high_slope_mask.sum()}) ---")
#     print(classification_report(y_high_slope, preds_high_slope, target_names=['Dry Regolith (0)', 'OH/H2O Present (1)'], digits=4))
# else:
#     print("\nNo terrain samples found with Slope > 10° for stress testing.")

# =============================================================================
# PHASE 4: Diagnostic SHAP & Physics Verification (Patched)
# =============================================================================
print("[PHASE 4] Executing SHAP Attribution and Roughness Stress Test...")

# 1. SHAP Feature Attribution Analysis (Fix: pass booster or use model.get_booster())
try:
    # Attempt using the underlying XGBoost booster object to bypass string parsing bug
    booster = final_model.get_booster()
    explainer = shap.TreeExplainer(booster)
    shap_values = explainer(X)
except Exception as e:
    print(f"Direct TreeExplainer warning ({e}), falling back to shap.Explainer...")
    explainer = shap.Explainer(final_model.predict, X)
    shap_values = explainer(X)

plt.figure(figsize=(10, 6))
shap.summary_plot(shap_values, X, show=False)
plt.title("SHAP Feature Importance (Leakage-Free Option B)", fontsize=12)
plt.tight_layout()
plt.savefig("shap_summary_leakage_free.png", dpi=300)
plt.close()
print("Saved SHAP summary plot to 'shap_summary_leakage_free.png'.")

# 2. Roughness & Slope Ambiguity Stress Test
high_slope_mask = X['Slope_deg_TMC2'] > 10.0
if high_slope_mask.sum() > 0:
    y_high_slope = y[high_slope_mask]
    preds_high_slope = oof_preds[high_slope_mask]
    
    print(f"\n--- Stress Test: High-Slope / Rough Terrain (>10°, N={high_slope_mask.sum()}) ---")
    print(classification_report(y_high_slope, preds_high_slope, target_names=['Dry Regolith (0)', 'OH/H2O Present (1)'], digits=4))
else:
    print("\nNo terrain samples found with Slope > 10° for stress testing.")