"""
polarimetry.py — Full-polarimetric radar backscatter decomposition and ice scoring engine.
Implements Chandrayaan-2 DFSAR polarimetric physics per Sinha et al. (May 2026, PRL Ahmedabad).
"""
import numpy as np
from algorithms.ice_confidence import compute_ics as _canonical_ics

def compute_stokes_parameters(shh: np.ndarray, svv: np.ndarray, shv: np.ndarray = None):
    """
    Computes 4-element Stokes vector S = [S0, S1, S2, S3] from real power radar cross-sections.
    Inputs must be real-valued power (intensity) arrays, not complex amplitudes.
    """
    # Total power S0
    s0 = shh + svv
    s1 = shh - svv
    
    if shv is not None:
        # S2 = 2 * sqrt(Shh) * sqrt(Svv) for real power inputs (geometric mean of amplitudes)
        s2 = 2.0 * np.sqrt(np.maximum(shh, 0.0)) * np.sqrt(np.maximum(svv, 0.0))
        s3 = 2.0 * np.imag(shv)
    else:
        # In compact/hybrid polarimetry approximation
        s2 = np.zeros_like(s0)
        s3 = np.zeros_like(s0)
        
    return s0, s1, s2, s3

def compute_dop(s0: np.ndarray, s1: np.ndarray, s2: np.ndarray, s3: np.ndarray, eps: float = 1e-6) -> np.ndarray:
    """
    Computes Degree of Polarization (DOP, m):
    m = sqrt(S1^2 + S2^2 + S3^2) / S0
    """
    polarized_power = np.sqrt(s1**2 + s2**2 + s3**2)
    dop = polarized_power / np.maximum(s0, eps)
    return np.clip(dop, 0.0, 1.0)

def m_chi_decomposition(s0: np.ndarray, s3: np.ndarray, dop: np.ndarray, eps: float = 1e-6):
    """
    Implements m-chi Stokes polarimetric target decomposition:
    - P_volume: Volumetric / Diffuse scattering (dominant in ice)
    - P_double: Dihedral / Double-bounce scattering (crater walls, boulders)
    - P_surface: Bragg / Single surface reflection (smooth regolith)
    """
    m = np.clip(dop, 0.0, 1.0)
    sin_2chi = np.clip(-s3 / np.maximum(m * s0, eps), -1.0, 1.0)
    
    p_vol = s0 * (1.0 - m)
    p_dbl = s0 * m * ((1.0 - sin_2chi) / 2.0)
    p_srf = s0 * m * ((1.0 + sin_2chi) / 2.0)
    
    return p_vol, p_dbl, p_srf

def compute_ice_confidence_score(cpr: np.ndarray, dop: np.ndarray) -> np.ndarray:
    """
    Computes continuous Ice Confidence Score (ICS in [0, 1]) based on Sinha et al. (2026).
    Delegates to the single canonical implementation in ice_confidence.py to avoid
    divergent normalization constants across the codebase.
    """
    return _canonical_ics(cpr, dop)
