"""
patch_notebook.py — Patches craters.ipynb to include self-healing auto-installer
for any missing packages in the active Jupyter kernel.
"""
import json
import os

paths = [
    r'c:\Users\patil\OneDrive\ISRO\craters.ipynb',
    r'c:\Users\patil\OneDrive - South Indian Education Society\Desktop\ISRO\craters.ipynb'
]

installer_code = """# Cell 1: Self-Healing Setup (Auto-installs missing packages in the active Jupyter kernel)
import sys
import subprocess

required = ['pandas', 'numpy', 'matplotlib', 'seaborn', 'scikit-learn', 'scipy']
for pkg in required:
    mod_name = 'sklearn' if pkg == 'scikit-learn' else pkg
    try:
        __import__(mod_name)
    except ImportError:
        print(f"Installing missing package '{pkg}' into active kernel...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "-q"])

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score

# Visualization Styling
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
plt.rcParams['figure.dpi'] = 150
plt.rcParams['font.size'] = 10

# Lunar Physical Constants
R_MOON_KM = 1737.4

print("All required packages are verified and successfully imported into active kernel.")
print(f"Lunar reference radius: {R_MOON_KM} km")"""

csv_loader_code = """# Ingestion of the 1.3-Million Crater Dataset with Multi-Path Discovery
candidate_paths = [
    r'c:\\Users\\patil\\OneDrive\\ISRO\\lunar_crater_database_robbins_2018.csv',
    r'lunar_crater_database_robbins_2018.csv',
    r'../lunar_crater_database_robbins_2018.csv',
    r'c:\\Users\\patil\\OneDrive - South Indian Education Society\\Desktop\\ISRO\\lunar_crater_database_robbins_2018.csv'
]

csv_path = None
for cp in candidate_paths:
    if os.path.exists(cp):
        csv_path = cp
        break

if not csv_path:
    raise FileNotFoundError("lunar_crater_database_robbins_2018.csv not found in candidate paths!")

print(f"Reading dataset from: {csv_path}...")
df = pd.read_csv(csv_path)

# Feature Engineering
df['LON_180'] = df['LON_CIRC_IMG'].apply(lambda x: x - 360 if x > 180 else x)
df['ELLIPTICITY'] = df['DIAM_ELLI_MAJOR_IMG'] / np.maximum(df['DIAM_ELLI_MINOR_IMG'], 0.001)
df['CIRCULARITY'] = 1.0 - df['DIAM_ELLI_ECCEN_IMG']
df['IS_SOUTH_POLAR'] = df['LAT_CIRC_IMG'] <= -70.0
df['IS_NORTH_POLAR'] = df['LAT_CIRC_IMG'] >= 70.0

print(f"Successfully loaded {len(df):,} craters.")
display(df[['CRATER_ID', 'LAT_CIRC_IMG', 'LON_CIRC_IMG', 'DIAM_CIRC_IMG', 'DIAM_ELLI_ECCEN_IMG', 'ARC_IMG', 'PTS_RIM_IMG']].head())"""

for p in paths:
    if not os.path.exists(p):
        continue
    with open(p, 'r', encoding='utf-8') as f:
        nb = json.load(f)

    for cell in nb['cells']:
        if cell['cell_type'] == 'code':
            src = ''.join(cell['source'])
            if 'Environment & Library Setup' in src or 'Self-Healing Setup' in src:
                cell['source'] = [line + '\n' for line in installer_code.split('\n')]
            elif 'Ingestion of the 1.3-Million Crater Dataset' in src:
                cell['source'] = [line + '\n' for line in csv_loader_code.split('\n')]

    with open(p, 'w', encoding='utf-8') as f_out:
        json.dump(nb, f_out, indent=2)
    print(f"Patched: {p}")

print("Done patching craters.ipynb!")
