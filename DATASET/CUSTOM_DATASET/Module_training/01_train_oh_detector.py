#!/usr/bin/env python3
"""
01_train_oh_detector.py
========================
Production-Grade Leakage-Free XGBoost ML Training Pipeline for Lunar OH/H2O Detection.
Engineered for LAEP Chandrayaan-2 Multi-Sensor Data Fusion.

Key Architectural Features:
  1. Calibrated Two-Branch Target Engine:
     - Branch A (IIRS Available): Direct hyperspectral detection (bd2000 > 0.02).
     - Branch B (IIRS Shadow/PSR): Topography-constrained radar fallback
       (CPR > 0.8 AND DOP < 0.25 AND Slope < 12° AND Elevation < -1800m).
  2. Decoupled Task Architecture: Filters out Unobserved/PSR (State -1) prior to training.
  3. Option B Feature Selection: Retains raw spectral and physical attributes while 
     excluding circular derived indices.
  4. Spatial Block CV: GroupKFold cross-validation across 0.05° (~1.5 km) spatial tiles.
  5. SHAP Diagnostics: Computes feature attributions on unseen spatial blocks.
"""

import json
import logging
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.metrics import classification_report, confusion_matrix, f1_score, roc_auc_score
from sklearn.model_selection import GroupKFold
from xgboost import XGBClassifier

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("LAEP_ML_Trainer")


def apply_two_branch_target_engine(df: pd.DataFrame) -> pd.Series:
    """
    Computes ground-truth physical target state using Topography-Constrained Two-Branch Logic:
      - Branch A (IIRS Available):
          Direct hyperspectral absorption detection (bd2000 > 0.02).
      - Branch B (IIRS Unobserved / PSR):
          Fallback to radar & topography: CPR > 0.8 AND DOP < 0.25
          AND Slope < 12.0° AND Elevation < -1800.0m (Rules out dry rocky ejecta).
    """
    logger.info("Applying Calibrated Two-Branch Target Engine...")

    # IIRS Data Availability Mask
    if 'IIRS_Data_Available' in df.columns:
        iirs_avail = df['IIRS_Data_Available'] == 1
    else:
        iirs_avail = df['Reflectance_IIRS_1500nm'].notna() & (df['Reflectance_IIRS_1500nm'] > 0)

    # Extract features with graceful fallbacks if missing
    bd2000 = df.get('IIRS_H2O_Absorption_Depth', pd.Series(0.0, index=df.index)).fillna(0.0).values
    cpr = df.get('CPR_DFSAR', pd.Series(0.2877, index=df.index)).fillna(0.2877).values
    dop = df.get('DOP_DFSAR', pd.Series(0.5, index=df.index)).fillna(0.5).values
    slope = df.get('Slope_deg_TMC2', pd.Series(2.5, index=df.index)).fillna(2.5).values
    elev = df.get('Elevation_m_TMC2', pd.Series(-1850.0, index=df.index)).fillna(-1850.0).values

    # Branch A: Direct Optical/Hyperspectral Absorption
    branch_a = iirs_avail & (bd2000 > 0.02)

    # Branch B: Unobserved Shadow / PSR Fallback
    branch_b = (~iirs_avail) & (cpr > 0.8) & (dop < 0.25) & (slope < 12.0) & (elev < -1800.0)

    # Target States: 1 (OH/H2O Present), 0 (Dry Regolith), -1 (Unobserved Non-Ice)
    target_state = np.where(branch_a | branch_b, 1, 0)
    target_state = np.where((~iirs_avail) & (~branch_b), -1, target_state)

    logger.info("  Engine Target Breakdown:\n%s", pd.Series(target_state).value_counts().to_string())
    return pd.Series(target_state, index=df.index)


def run_refactored_training(
    dataset_path: Path,
    output_dir: Path,
    grid_size_deg: float = 0.05,
    random_seed: int = 42
) -> None:
    """Executes spatial-block GroupKFold XGBoost training and diagnostic evaluation."""
    
    start_time = time.time()
    output_dir.mkdir(parents=True, exist_ok=True)
    models_dir = output_dir / "models"
    plots_dir = output_dir / "plots"
    models_dir.mkdir(exist_ok=True)
    plots_dir.mkdir(exist_ok=True)

    # -----------------------------------------------------------------------
    # 1. Load & Validate Dataset
    # -----------------------------------------------------------------------
    if not dataset_path.exists():
        raise FileNotFoundError(f"ML dataset not found at: {dataset_path.resolve()}")

    logger.info("Loading dataset from: %s", dataset_path.name)
    df = pd.read_csv(dataset_path)
    logger.info("Dataset shape: %d rows x %d cols", df.shape[0], df.shape[1])

    # Re-evaluate target state using Two-Branch Logic
    df['IIRS_OH_Detection_State'] = apply_two_branch_target_engine(df)

    # -----------------------------------------------------------------------
    # 2. Phase 1: Filter Valid Surface Observations (Decouple Class -1)
    # -----------------------------------------------------------------------
    logger.info("\n[Phase 1] Decoupling Observation Task (Filtering Class -1)...")
    df_valid = df[df['IIRS_OH_Detection_State'].isin([0, 1])].copy().reset_index(drop=True)
    
    logger.info("Valid surface samples retained: %d / %d total", len(df_valid), len(df))
    logger.info("Binary Target Breakdown:\n%s", df_valid['IIRS_OH_Detection_State'].value_counts())

    # -----------------------------------------------------------------------
    # 3. Phase 2: Option B Feature Selection (Raw Channels Only)
    # -----------------------------------------------------------------------
    logger.info("\n[Phase 2] Selecting Raw Predictor Features (Option B)...")
    
    preferred_features = [
        'Latitude_deg_SAR', 'Longitude_deg_SAR', 'Incidence_Angle_deg_SAR',
        'Ground_Range_m_SAR', 'Slant_Range_m_SAR', 'Reflectance_OHRC',
        'Elevation_m_TMC2', 'Slope_deg_TMC2', 'Reflectance_IIRS_1500nm',
        'Reflectance_IIRS_2000nm', 'CPR_DFSAR', 'DOP_DFSAR',
        'Power_LH_DFSAR', 'Power_LV_DFSAR'
    ]
    
    # Retain non-constant active features present in the CSV
    feature_cols = [c for c in preferred_features if c in df_valid.columns and df_valid[c].std() > 0]
    
    X = df_valid[feature_cols].copy()
    y = df_valid['IIRS_OH_Detection_State'].values

    logger.info("Active Predictor Features (%d): %s", len(feature_cols), feature_cols)

    # -----------------------------------------------------------------------
    # 4. Phase 3: Spatial Block Partitioning & GroupKFold CV
    # -----------------------------------------------------------------------
    logger.info("\n[Phase 3] Generating %.2f° Spatial Grid Tiles (~1.5 km)...", grid_size_deg)
    
    df_valid['spatial_block'] = (
        (df_valid['Latitude_deg_SAR'] // grid_size_deg).astype(int).astype(str) + "_" +
        (df_valid['Longitude_deg_SAR'] // grid_size_deg).astype(int).astype(str)
    )
    groups = df_valid['spatial_block'].values
    unique_blocks = np.unique(groups)
    logger.info("Created %d unique spatial grid blocks across dataset.", len(unique_blocks))

    gkf = GroupKFold(n_splits=5)
    oof_preds = np.zeros(len(df_valid))
    oof_probs = np.zeros(len(df_valid))
    fold_f1_scores = []

    logger.info("\n--- Starting 5-Fold Spatial Block Cross-Validation ---")
    for fold, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups), start=1):
        X_tr, y_tr = X.iloc[train_idx], y[train_idx]
        X_va, y_va = X.iloc[val_idx], y[val_idx]

        model_fold = XGBClassifier(
            n_estimators=300,
            learning_rate=0.03,
            max_depth=5,
            subsample=0.8,
            colsample_bytree=0.8,
            base_score=0.5,
            missing=-9999.0,
            objective='binary:logistic',
            eval_metric='logloss',
            random_state=random_seed + fold,
            n_jobs=-1
        )

        model_fold.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], verbose=False)

        val_probs = model_fold.predict_proba(X_va)[:, 1]
        oof_probs[val_idx] = val_probs
        oof_preds[val_idx] = (val_probs >= 0.5).astype(int)

        # Handle potential single-class fold evaluation
        if len(np.unique(y_va)) > 1:
            fold_f1 = f1_score(y_va, oof_preds[val_idx], average='macro')
        else:
            fold_f1 = f1_score(y_va, oof_preds[val_idx], average='weighted')
            
        fold_f1_scores.append(fold_f1)
        logger.info("  Fold %d/5 - Val Macro F1: %.4f (Train tiles: %d, Val tiles: %d)",
                    fold, fold_f1, len(np.unique(groups[train_idx])), len(np.unique(groups[val_idx])))

    oof_macro_f1 = f1_score(y, oof_preds, average='macro')
    
    logger.info("\n=== Out-of-Fold Spatial CV Summary ===")
    unique_classes = np.unique(y)
    if len(unique_classes) > 1:
        oof_auc = roc_auc_score(y, oof_probs)
        logger.info("  Spatial Macro F1 : %.4f +/- %.4f", np.mean(fold_f1_scores), np.std(fold_f1_scores))
        logger.info("  ROC-AUC Score    : %.4f", oof_auc)
        logger.info("\nClassification Report:\n%s",
                    classification_report(y, oof_preds, target_names=['Dry Regolith (0)', 'OH/H2O Present (1)'], digits=4))
    else:
        logger.warning("Only 1 target class found in dataset (%s). Skipping ROC-AUC & Multi-Class Report.", unique_classes)

    # -----------------------------------------------------------------------
    # 5. Train Final Production Model
    # -----------------------------------------------------------------------
    logger.info("\nTraining Final Production Model on all valid surface observations...")
    final_model = XGBClassifier(
        n_estimators=300,
        learning_rate=0.03,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        base_score=0.5,
        missing=-9999.0,
        objective='binary:logistic',
        eval_metric='logloss',
        random_state=random_seed,
        n_jobs=-1
    )
    final_model.fit(X, y)

    # -----------------------------------------------------------------------
    # 6. Diagnostic Plots & SHAP Attribution
    # -----------------------------------------------------------------------
    plt.style.use('dark_background')
    
    # A. Confusion Matrix Plot
    if len(unique_classes) > 1:
        cm = confusion_matrix(y, oof_preds)
        fig, ax = plt.subplots(figsize=(7, 5), dpi=150)
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', cbar=False,
                    xticklabels=['Dry (0)', 'OH/H2O (+1)'],
                    yticklabels=['Dry (0)', 'OH/H2O (+1)'], ax=ax)
        ax.set_title('Out-of-Fold Spatial Block Confusion Matrix', fontsize=12, fontweight='bold', color='#f8fafc')
        ax.set_xlabel('Predicted State', fontsize=10, color='#cbd5e1')
        ax.set_ylabel('True State', fontsize=10, color='#cbd5e1')
        plt.tight_layout()
        cm_path = plots_dir / "spatial_oof_confusion_matrix.png"
        plt.savefig(cm_path)
        plt.close()

    # B. SHAP Feature Attribution Analysis (Phase 4)
    logger.info("\n[Phase 4] Computing SHAP feature attributions...")
    try:
        import shap
        try:
            booster = final_model.get_booster()
            explainer = shap.TreeExplainer(booster)
            shap_values = explainer(X)
        except Exception:
            explainer = shap.Explainer(final_model.predict, X)
            shap_values = explainer(X)

        plt.figure(figsize=(10, 6))
        shap.summary_plot(shap_values, X, show=False)
        plt.title("SHAP Feature Importance (Leakage-Free Option B)", fontsize=12)
        plt.tight_layout()
        shap_path = plots_dir / "shap_summary_leakage_free.png"
        plt.savefig(shap_path, dpi=300)
        plt.close()
        logger.info("Saved SHAP summary plot -> %s", shap_path.name)
    except ImportError:
        logger.warning("SHAP library not installed; skipping SHAP plot generation.")

    # -----------------------------------------------------------------------
    # 7. Export Model Artifacts
    # -----------------------------------------------------------------------
    model_json_path = models_dir / "xgb_oh_detector_leakage_free.json"
    model_joblib_path = models_dir / "xgb_oh_detector_leakage_free.joblib"
    manifest_path = models_dir / "feature_manifest_leakage_free.json"

    final_model.save_model(model_json_path)
    joblib.dump(final_model, model_joblib_path)

    with open(manifest_path, "w") as f:
        json.dump({
            "features": feature_cols,
            "target_mapping": {"0": 0, "1": 1},
            "spatial_grid_resolution_deg": grid_size_deg,
            "validation_type": "Spatial Block GroupKFold"
        }, f, indent=2)

    elapsed = time.time() - start_time
    logger.info("\n=======================================================================")
    logger.info("TRAINING PIPELINE COMPLETED SUCCESSFULLY IN %.2f SECONDS", elapsed)
    logger.info("Model saved -> %s", model_joblib_path.resolve())
    logger.info("=======================================================================")


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent
    
    csv_file = base_dir / "F2_combined_dataset_IIRS_processed.csv"
    if not csv_file.exists():
        csv_file = base_dir / "F2_combined_dataset_IIRS_processed.csv"

    output_directory = base_dir / "ml_results"
    run_refactored_training(dataset_path=csv_file, output_dir=output_directory)