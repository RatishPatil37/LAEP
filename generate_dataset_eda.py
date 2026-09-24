import os
import sys
from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

# Configure paths
csv_path = r'c:\Users\patil\OneDrive\ISRO\DATASET\LAEP_Pipeline\code\F2_combined_dataset_1790091673.csv'
artifact_dir = Path(r'C:\Users\patil\.gemini\antigravity-ide\brain\f9393ad2-722f-49b0-ac89-82bb5421b5d3')
out_dir_artifact = artifact_dir / 'eda_figures'
out_dir_local = Path(r'c:\Users\patil\OneDrive - South Indian Education Society\Desktop\ISRO\figures')

out_dir_artifact.mkdir(parents=True, exist_ok=True)
out_dir_local.mkdir(parents=True, exist_ok=True)

# Load Dataset
print(f"Loading dataset from: {csv_path}")
df = pd.read_csv(csv_path)
print(f"Loaded {df.shape[0]} rows and {df.shape[1]} columns.")

# Dark aerospace aesthetics for charts
plt.style.use('dark_background')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['axes.edgecolor'] = '#334155'
plt.rcParams['axes.linewidth'] = 0.8
plt.rcParams['grid.color'] = '#1e293b'
plt.rcParams['grid.linestyle'] = '--'
plt.rcParams['grid.alpha'] = 0.6

# Modality masks
has_iirs = df['Reflectance_IIRS_1500nm'].notna()
# OHRC true measurement vs fallback (mean fill is 0.1653)
has_real_ohrc = (df['Reflectance_OHRC'] != 0.1653) & (df['Reflectance_OHRC'] > 0)

# Determine coverage category for each point
def get_modality(row_idx):
    iirs = has_iirs.iloc[row_idx]
    ohrc = has_real_ohrc.iloc[row_idx]
    if iirs and ohrc:
        return 'Triple Overlap (SAR+OHRC+IIRS)'
    elif iirs:
        return 'Dual (SAR + IIRS)'
    elif ohrc:
        return 'Dual (SAR + OHRC)'
    else:
        return 'SAR Only (No Overlap)'

df['Modality_Category'] = [get_modality(i) for i in range(len(df))]

# -------------------------------------------------------------
# FIGURE 1: Spatial Coverage & Modality Overlap
# -------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7), dpi=300)

# Subplot 1: Modality Category
palette1 = {
    'Triple Overlap (SAR+OHRC+IIRS)': '#2dd4bf',  # Cyan / Teal
    'Dual (SAR + IIRS)': '#38bdf8',              # Sky Blue
    'Dual (SAR + OHRC)': '#f59e0b',              # Amber
    'SAR Only (No Overlap)': '#475569'           # Slate Grey
}

sns.scatterplot(
    data=df,
    x='Longitude_deg_SAR',
    y='Latitude_deg_SAR',
    hue='Modality_Category',
    palette=palette1,
    s=8,
    alpha=0.75,
    ax=ax1,
    edgecolor='none'
)
ax1.set_title('A. Multi-Sensor Spatial Overlap & Swath Discrepancy', fontsize=12, fontweight='bold', color='#f8fafc', pad=12)
ax1.set_xlabel('Longitude (°E)', fontsize=10, color='#94a3b8')
ax1.set_ylabel('Latitude (°N)', fontsize=10, color='#94a3b8')
ax1.grid(True)
ax1.legend(loc='lower left', framealpha=0.85, facecolor='#0f172a', edgecolor='#334155', fontsize=8)

# Subplot 2: Hazard Class Spatial Distribution
palette2 = {
    'safe_flat': '#10b981',                 # Emerald green
    'shadowing_obscuration': '#6366f1',     # Indigo
    'boulder': '#ef4444'                    # Bright red
}

sns.scatterplot(
    data=df,
    x='Longitude_deg_SAR',
    y='Latitude_deg_SAR',
    hue='Hazard_Class_Label',
    palette=palette2,
    s=8,
    alpha=0.75,
    ax=ax2,
    edgecolor='none'
)
ax2.set_title('B. Rule-Based Hazard Class Spatial Distribution', fontsize=12, fontweight='bold', color='#f8fafc', pad=12)
ax2.set_xlabel('Longitude (°E)', fontsize=10, color='#94a3b8')
ax2.set_ylabel('Latitude (°N)', fontsize=10, color='#94a3b8')
ax2.grid(True)
ax2.legend(loc='lower left', framealpha=0.85, facecolor='#0f172a', edgecolor='#334155', fontsize=8)

plt.tight_layout()
fig.savefig(out_dir_artifact / 'fig1_spatial_coverage_modalities.png', bbox_inches='tight')
fig.savefig(out_dir_local / 'fig1_spatial_coverage_modalities.png', bbox_inches='tight')
plt.close(fig)
print("Saved Figure 1.")

# -------------------------------------------------------------
# FIGURE 2: Data Integrity, Missingness & Synthetic Artifacts
# -------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6), dpi=300)

# Missingness / Fallback classification
total_rows = len(df)
categories = [
    ('SAR Orbit/Geometry', 20000, 0, 0),
    ('CPR (DFSAR)', 0, 0, 20000),             # 100% constant fallback 0.05
    ('DOP (DFSAR)', 0, 0, 20000),             # 100% constant fallback 0.9048
    ('TMC-2 DEM / Slope', 0, 20000, 0),       # 100% derived radargrammetry
    ('OHRC Optical', 4390, 15610, 0),         # 4,390 measured, 15,610 global mean fill
    ('IIRS Hyperspectral', 8156, 0, 11844)     # 8,156 measured, 11,844 NaN
]

labels = [c[0] for c in categories]
measured = [c[1] / total_rows * 100 for c in categories]
approximated = [c[2] / total_rows * 100 for c in categories]
missing_or_constant = [c[3] / total_rows * 100 for c in categories]

y_pos = np.arange(len(labels))
ax1.barh(y_pos, measured, color='#2dd4bf', label='Genuine Measured In-Swath Data')
ax1.barh(y_pos, approximated, left=measured, color='#f59e0b', label='Approximated / Filled Mean')
ax1.barh(y_pos, missing_or_constant, left=np.array(measured) + np.array(approximated), color='#ef4444', label='Constant Fallback / NaN Out-of-Swath')

ax1.set_yticks(y_pos)
ax1.set_yticklabels(labels, fontsize=10, color='#e2e8f0')
ax1.set_xlabel('Percentage of Total 20,000 Rows (%)', fontsize=10, color='#94a3b8')
ax1.set_title('A. Feature Truthfulness & Missingness Breakdown', fontsize=12, fontweight='bold', color='#f8fafc', pad=12)
ax1.set_xlim(0, 100)
ax1.grid(True, axis='x')
ax1.legend(loc='lower center', bbox_to_anchor=(0.5, -0.22), ncol=3, framealpha=0.85, facecolor='#0f172a', edgecolor='#334155', fontsize=8)

# Subplot 2: Hazard Class Distribution (with log and linear values)
counts = df['Hazard_Class_Label'].value_counts()
pcts = counts / total_rows * 100
colors = ['#10b981', '#6366f1', '#ef4444']

bars = ax2.bar(counts.index, counts.values, color=colors, edgecolor='#334155', width=0.5)
ax2.set_title('B. Extreme Class Imbalance in Hazard Ground Truth', fontsize=12, fontweight='bold', color='#f8fafc', pad=12)
ax2.set_ylabel('Sample Count (Log Scale)', fontsize=10, color='#94a3b8')
ax2.set_yscale('log')
ax2.set_ylim(1, 40000)
ax2.grid(True, axis='y')

for bar, count, pct in zip(bars, counts.values, pcts.values):
    height = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2., height * 1.25,
             f'{count:,}\n({pct:.2f}%)',
             ha='center', va='bottom', fontsize=9, color='#f8fafc', fontweight='bold')

plt.tight_layout()
fig.savefig(out_dir_artifact / 'fig2_data_integrity_missingness.png', bbox_inches='tight')
fig.savefig(out_dir_local / 'fig2_data_integrity_missingness.png', bbox_inches='tight')
plt.close(fig)
print("Saved Figure 2.")

# -------------------------------------------------------------
# FIGURE 3: Spectral & Physical Distributions (IIRS & OHRC)
# -------------------------------------------------------------
fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 10), dpi=300)

# Subplot 1: Real OHRC Reflectance Distribution
real_ohrc_vals = df.loc[has_real_ohrc, 'Reflectance_OHRC']
sns.histplot(real_ohrc_vals, bins=50, kde=True, color='#f59e0b', ax=ax1, edgecolor='#1e293b')
ax1.axvline(0.05, color='#6366f1', linestyle='--', linewidth=1.5, label='Shadow Cutoff (<0.05)')
ax1.axvline(0.65, color='#ef4444', linestyle='--', linewidth=1.5, label='Boulder Cutoff (>0.65)')
ax1.set_title(f'A. OHRC Genuine Reflectance (N={len(real_ohrc_vals):,})', fontsize=11, fontweight='bold', color='#f8fafc')
ax1.set_xlabel('Reflectance (I/F or Normalized Pixel Intensity)', fontsize=9, color='#94a3b8')
ax1.set_ylabel('Pixel Frequency', fontsize=9, color='#94a3b8')
ax1.grid(True)
ax1.legend(framealpha=0.85, facecolor='#0f172a', edgecolor='#334155', fontsize=8)

# Subplot 2: IIRS R1500 vs R2000 Scatter
valid_iirs = df.dropna(subset=['Reflectance_IIRS_1500nm', 'Reflectance_IIRS_2000nm'])
ax2.scatter(valid_iirs['Reflectance_IIRS_1500nm'], valid_iirs['Reflectance_IIRS_2000nm'],
            c=valid_iirs['IIRS_H2O_Absorption_Depth'], cmap='viridis', s=6, alpha=0.6)
# 1:1 reference line
max_r = max(valid_iirs['Reflectance_IIRS_1500nm'].quantile(0.99), valid_iirs['Reflectance_IIRS_2000nm'].quantile(0.99))
ax2.plot([0, max_r], [0, max_r], color='#ef4444', linestyle='--', label='1:1 Ratio (No Absorption)')
ax2.set_title(f'B. IIRS Continuum (1500nm) vs Absorption (2000nm)', fontsize=11, fontweight='bold', color='#f8fafc')
ax2.set_xlabel('Reflectance / Radiance at 1500nm', fontsize=9, color='#94a3b8')
ax2.set_ylabel('Reflectance / Radiance at 2000nm', fontsize=9, color='#94a3b8')
ax2.set_xlim(0, max_r)
ax2.set_ylim(0, max_r)
ax2.grid(True)
ax2.legend(framealpha=0.85, facecolor='#0f172a', edgecolor='#334155', fontsize=8)

# Subplot 3: IIRS Band Ratio Distribution
sns.histplot(valid_iirs['IIRS_Band_Ratio'], bins=50, kde=True, color='#38bdf8', ax=ax3, edgecolor='#1e293b')
ax3.axvline(1.0, color='#ef4444', linestyle='--', linewidth=1.5, label='Neutral Ratio = 1.0')
ax3.set_title(f'C. IIRS Band Ratio (R1500 / R2000) Distribution', fontsize=11, fontweight='bold', color='#f8fafc')
ax3.set_xlabel('Band Ratio (R1500 / R2000)', fontsize=9, color='#94a3b8')
ax3.set_ylabel('Pixel Frequency', fontsize=9, color='#94a3b8')
ax3.set_xlim(0, 3)
ax3.grid(True)
ax3.legend(framealpha=0.85, facecolor='#0f172a', edgecolor='#334155', fontsize=8)

# Subplot 4: IIRS Absorption Depth (BD2000) Anomaly
sns.histplot(valid_iirs['IIRS_H2O_Absorption_Depth'], bins=50, kde=True, color='#a855f7', ax=ax4, edgecolor='#1e293b')
ax4.axvline(0.0, color='#f8fafc', linestyle='-', linewidth=1.2, label='Zero Absorption (BD=0)')
ax4.axvline(valid_iirs['IIRS_H2O_Absorption_Depth'].mean(), color='#ef4444', linestyle='--',
            label=f'Mean BD ({valid_iirs["IIRS_H2O_Absorption_Depth"].mean():.2f})')
ax4.set_title(f'D. IIRS H2O Band Depth (BD2000) Inversion Anomaly', fontsize=11, fontweight='bold', color='#f8fafc')
ax4.set_xlabel('H2O Absorption Depth (1 - R2000/R_cont)', fontsize=9, color='#94a3b8')
ax4.set_ylabel('Pixel Frequency', fontsize=9, color='#94a3b8')
ax4.grid(True)
ax4.legend(framealpha=0.85, facecolor='#0f172a', edgecolor='#334155', fontsize=8)

plt.tight_layout()
fig.savefig(out_dir_artifact / 'fig3_spectral_feature_distributions.png', bbox_inches='tight')
fig.savefig(out_dir_local / 'fig3_spectral_feature_distributions.png', bbox_inches='tight')
plt.close(fig)
print("Saved Figure 3.")

# -------------------------------------------------------------
# FIGURE 4: Terrain, Radargrammetry & Slope Analysis
# -------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5), dpi=300)

# Subplot 1: Derived Radargrammetric Slope Distribution
sns.histplot(df['Slope_deg_TMC2'], bins=40, kde=True, color='#14b8a6', ax=ax1, edgecolor='#1e293b')
ax1.axvline(15.0, color='#ef4444', linestyle='--', linewidth=2, label='Steep Hazard Threshold (>15°)')
ax1.set_title('A. Radargrammetric Derived Slope Distribution', fontsize=11, fontweight='bold', color='#f8fafc')
ax1.set_xlabel('Derived Slope (°)', fontsize=9, color='#94a3b8')
ax1.set_ylabel('Point Count', fontsize=9, color='#94a3b8')
ax1.grid(True)
ax1.legend(framealpha=0.85, facecolor='#0f172a', edgecolor='#334155', fontsize=8)

# Subplot 2: Incidence Angle vs Ground Range vs Slant Range
sc = ax2.scatter(
    df['Ground_Range_m_SAR'] / 1000,
    df['Slant_Range_m_SAR'] / 1000,
    c=df['Incidence_Angle_deg_SAR'],
    cmap='plasma',
    s=8,
    alpha=0.6
)
cbar = plt.colorbar(sc, ax=ax2)
cbar.set_label('Incidence Angle (°)', color='#94a3b8')
cbar.ax.yaxis.set_tick_params(color='#94a3b8')
plt.setp(plt.getp(cbar.ax.axes, 'yticklabels'), color='#94a3b8')

ax2.set_title('B. 3D Radar Geometry Consistency (Slant vs Ground Range)', fontsize=11, fontweight='bold', color='#f8fafc')
ax2.set_xlabel('Ground Range (km)', fontsize=9, color='#94a3b8')
ax2.set_ylabel('Slant Range (km)', fontsize=9, color='#94a3b8')
ax2.grid(True)

plt.tight_layout()
fig.savefig(out_dir_artifact / 'fig4_terrain_radargrammetry_geometry.png', bbox_inches='tight')
fig.savefig(out_dir_local / 'fig4_terrain_radargrammetry_geometry.png', bbox_inches='tight')
plt.close(fig)
print("Saved Figure 4.")

# -------------------------------------------------------------
# FIGURE 5: Correlation Heatmap of Active Physical Variables
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(10, 8), dpi=300)

corr_cols = [
    'Latitude_deg_SAR',
    'Longitude_deg_SAR',
    'Incidence_Angle_deg_SAR',
    'Ground_Range_m_SAR',
    'Slant_Range_m_SAR',
    'Reflectance_OHRC',
    'Elevation_m_TMC2',
    'Slope_deg_TMC2',
    'Reflectance_IIRS_1500nm',
    'Reflectance_IIRS_2000nm',
    'IIRS_Band_Ratio',
    'IIRS_H2O_Absorption_Depth'
]

corr_matrix = df[corr_cols].corr()

mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
sns.heatmap(
    corr_matrix,
    mask=mask,
    cmap='coolwarm',
    vmax=1.0,
    vmin=-1.0,
    center=0,
    annot=True,
    fmt='.2f',
    square=True,
    linewidths=0.5,
    cbar_kws={'shrink': 0.8, 'label': 'Pearson Correlation'},
    ax=ax,
    annot_kws={'size': 7.5}
)
ax.set_title('Multi-Sensor Physical Feature Cross-Correlation Matrix', fontsize=12, fontweight='bold', color='#f8fafc', pad=14)
plt.xticks(rotation=45, ha='right', fontsize=8, color='#cbd5e1')
plt.yticks(rotation=0, fontsize=8, color='#cbd5e1')

plt.tight_layout()
fig.savefig(out_dir_artifact / 'fig5_feature_correlation_matrix.png', bbox_inches='tight')
fig.savefig(out_dir_local / 'fig5_feature_correlation_matrix.png', bbox_inches='tight')
plt.close(fig)
print("Saved Figure 5.")

print("All 5 publication-quality EDA figures generated successfully.")
