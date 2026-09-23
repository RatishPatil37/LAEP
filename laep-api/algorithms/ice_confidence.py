"""
ice_confidence.py — Physics-based Ice Confidence Score (ICS) computation & Polarimetry Visualizers.

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
    """
    cpr_conf = np.clip((cpr - ICE_CPR_THRESHOLD) / 1.0, 0.0, 1.0)
    dop_conf = np.clip((ICE_DOP_THRESHOLD - dop) / 0.08, 0.0, 1.0)
    ics = np.sqrt(cpr_conf * dop_conf)
    return ics.astype(np.float32)


def ics_to_rgba_png(ics: np.ndarray) -> bytes:
    """
    Convert an ICS array to a transparent PNG heatmap (RGBA).
    Low ICS → transparent. High ICS → blue-to-cyan-to-white gradient.
    """
    from PIL import Image
    import io

    H, W = ics.shape
    rgba = np.zeros((H, W, 4), dtype=np.uint8)

    mask = ics > 0.05
    v = ics[mask]

    r = np.clip(v * 2 - 1, 0, 1) * 255
    g = np.clip(v * 2,     0, 1) * 255
    b = np.full_like(v, 255)
    a = np.clip(v * 220 + 35, 35, 255)

    rgba[mask, 0] = r.astype(np.uint8)
    rgba[mask, 1] = g.astype(np.uint8)
    rgba[mask, 2] = b.astype(np.uint8)
    rgba[mask, 3] = a.astype(np.uint8)

    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def cpr_to_rgba_png(cpr: np.ndarray) -> bytes:
    """
    Render Circular Polarization Ratio (CPR) as an RGBA PNG heatmap.
    CPR > 1.0 (ice-consistent anomaly) rendered in vivid cyan/white;
    CPR < 1.0 (rocky surface scattering) rendered in dark subtle blue.
    """
    from PIL import Image
    import io

    H, W = cpr.shape
    rgba = np.zeros((H, W, 4), dtype=np.uint8)

    norm_cpr = np.clip(cpr / 2.5, 0.0, 1.0)

    # Cyan/ice gradient for high CPR
    mask_high = cpr >= 1.0
    v_high = norm_cpr[mask_high]
    rgba[mask_high, 0] = (v_high * 160).astype(np.uint8)
    rgba[mask_high, 1] = np.clip(180 + v_high * 75, 180, 255).astype(np.uint8)
    rgba[mask_high, 2] = 255
    rgba[mask_high, 3] = np.clip(140 + v_high * 100, 140, 240).astype(np.uint8)

    # Dark blue background for lower CPR
    mask_low = (cpr < 1.0) & (cpr > 0.15)
    v_low = norm_cpr[mask_low]
    rgba[mask_low, 0] = (v_low * 40).astype(np.uint8)
    rgba[mask_low, 1] = (v_low * 90).astype(np.uint8)
    rgba[mask_low, 2] = (120 + v_low * 80).astype(np.uint8)
    rgba[mask_low, 3] = (v_low * 120).astype(np.uint8)

    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def dop_to_rgba_png(dop: np.ndarray) -> bytes:
    """
    Render Degree of Polarization (DOP) as an RGBA PNG heatmap.
    DOP < 0.2 (depolarized volumetric ice signal) rendered in intense magenta/violet;
    Higher DOP rendered in subtle purple/indigo.
    """
    from PIL import Image
    import io

    H, W = dop.shape
    rgba = np.zeros((H, W, 4), dtype=np.uint8)

    # Invert so low DOP (volume scattering) is prominent
    inv_dop = np.clip(1.0 - dop, 0.0, 1.0)
    mask = inv_dop > 0.2
    v = inv_dop[mask]

    rgba[mask, 0] = np.clip(180 + v * 75, 180, 255).astype(np.uint8)
    rgba[mask, 1] = (v * 70).astype(np.uint8)
    rgba[mask, 2] = np.clip(200 + v * 55, 200, 255).astype(np.uint8)
    rgba[mask, 3] = np.clip(v * 200 + 40, 40, 230).astype(np.uint8)

    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
