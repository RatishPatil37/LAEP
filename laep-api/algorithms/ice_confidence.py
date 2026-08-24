"""
ice_confidence.py — Physics-based Ice Confidence Score (ICS) computation.

Based on the criterion established by the Physical Research Laboratory & ISRO (2024):
  CPR > 1.0   AND   DOP < 0.13  →  subsurface ice signature

The ICS is a continuous float in [0, 1]:
  - 0.0  = definitely not ice (rocky surface)
  - 1.0  = strong ice signature (both thresholds clearly exceeded)
"""
import numpy as np
from config import ICE_CPR_THRESHOLD, ICE_DOP_THRESHOLD


def compute_ics(cpr: np.ndarray, dop: np.ndarray) -> np.ndarray:
    """
    Compute the Ice Confidence Score from CPR and DOP raster arrays.

    Args:
        cpr: 2D array of Circular Polarisation Ratio values
        dop: 2D array of Degree of Polarisation values

    Returns:
        ics: 2D float array in [0, 1]
    """
    # Normalised CPR confidence: how far above threshold?
    # Range [1.0, 2.0]: 0 if CPR <= 1.0, 1.0 if CPR >= 2.0
    cpr_conf = np.clip((cpr - ICE_CPR_THRESHOLD) / 1.0, 0.0, 1.0)

    # Normalised DOP confidence: how far below threshold?
    # Range [0.13, 0.05]: 1.0 at DOP <= 0.05 (very low polarization = volume scatter)
    #                     0.0 at DOP >= 0.13 (threshold)
    # Normalization span = 0.08 (empirical from Sinha et al. 2026 benchmark)
    dop_conf = np.clip((ICE_DOP_THRESHOLD - dop) / 0.08, 0.0, 1.0)

    # Both conditions must be satisfied — geometric mean gives joint confidence
    ics = np.sqrt(cpr_conf * dop_conf)

    return ics.astype(np.float32)


def ics_to_rgba_png(ics: np.ndarray) -> bytes:
    """
    Convert an ICS array to a transparent PNG heatmap (RGBA).
    Low ICS → transparent. High ICS → blue-to-cyan-to-white gradient.

    Returns:
        PNG bytes
    """
    from PIL import Image
    import io

    H, W = ics.shape
    rgba = np.zeros((H, W, 4), dtype=np.uint8)

    # Where ICS is meaningful (>0.05), paint with a cold blue palette
    mask = ics > 0.05
    v = ics[mask]

    # Colour ramp: dark blue (0) → cyan (0.5) → white (1.0)
    r = np.clip(v * 2 - 1, 0, 1) * 255
    g = np.clip(v * 2,     0, 1) * 255
    b = np.full_like(v, 255)
    a = np.clip(v * 220 + 35, 35, 255)   # partial transparency

    rgba[mask, 0] = r.astype(np.uint8)
    rgba[mask, 1] = g.astype(np.uint8)
    rgba[mask, 2] = b.astype(np.uint8)
    rgba[mask, 3] = a.astype(np.uint8)

    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
