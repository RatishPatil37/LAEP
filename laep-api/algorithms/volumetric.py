"""
volumetric.py — 2D Composite Simpson's Rule Volumetric & Water Mass Integration.
Calculates volatile deposit volume and accessible mass in Metric Tons based on
Ice Confidence Score (ICS), regolith penetration depth, and bulk density.
"""
import numpy as np
from scipy.integrate import simpson

def integrate_ice_volume_2d(
    ics_grid: np.ndarray,
    dx_m: float = 25.0,
    dy_m: float = 25.0,
    penetration_depth_m: float = 2.5,
    ice_volume_fraction: float = 0.056,
    bulk_ice_density_g_cm3: float = 0.917
) -> dict:
    """
    Computes 3D Ice Volume and Mass using 2D Composite Simpson's Rule.
    
    Formula:
    V_ice = \iint_\Omega [ ICS(x, y) * H(x, y) * V_f ] dx dy
    Mass_ice = V_ice * \rho_ice
    
    Parameters:
    - ics_grid: 2D array of Ice Confidence Scores (0 to 1)
    - dx_m, dy_m: Ground sampling grid resolution in meters (default: 25.0m for CH2 DFSAR)
    - penetration_depth_m: Radar penetration depth in meters (default: 2.5m for L/S band)
    - ice_volume_fraction: Regolith ice volume fraction (default: 5.6 wt% WEH per LCROSS / Sinha et al.)
    - bulk_ice_density_g_cm3: Pure/segregated ice density (default: 0.917 g/cm^3)
    
    Returns:
    - Dict with total_volume_m3, pure_ice_volume_m3, total_mass_metric_tons,
      ice_area_km2, peak_ics, mean_ics
    """
    ny, nx = ics_grid.shape
    if ny < 3 or nx < 3:
        # Fallback to Riemann sum if grid is too small
        effective_h = ics_grid * (penetration_depth_m * ice_volume_fraction)
        pure_volume_m3 = float(np.sum(effective_h) * dx_m * dy_m)
    else:
        # Construct integrand: height of pure ice equivalent per pixel (meters)
        integrand = ics_grid * (penetration_depth_m * ice_volume_fraction)
        
        # Integrate along x axis (columns), then along y axis (rows) using Simpson's rule
        # Ensure odd number of points along axes if possible or let scipy handle composite
        simps_x = np.array([simpson(integrand[r, :], dx=dx_m) for r in range(ny)])
        pure_volume_m3 = float(simpson(simps_x, dx=dy_m))

    pure_volume_m3 = max(0.0, pure_volume_m3)
    
    # Bulk ice density: 0.917 g/cm^3 = 917 kg/m^3 = 0.917 Metric Tons / m^3
    total_mass_metric_tons = pure_volume_m3 * (bulk_ice_density_g_cm3 * 1.0)
    
    # Area calculation
    valid_ice_mask = ics_grid > 0.2
    pixel_area_km2 = (dx_m * dy_m) / 1e6
    ice_area_km2 = float(np.sum(valid_ice_mask) * pixel_area_km2)
    
    total_deposit_regolith_volume_m3 = float(pure_volume_m3 / max(ice_volume_fraction, 1e-4))
    
    return {
        "pure_ice_volume_m3": round(pure_volume_m3, 2),
        "total_deposit_volume_m3": round(total_deposit_regolith_volume_m3, 2),
        "total_mass_metric_tons": round(total_mass_metric_tons, 2),
        "ice_area_km2": round(ice_area_km2, 4),
        "mean_ics": round(float(np.mean(ics_grid[valid_ice_mask])) if np.any(valid_ice_mask) else 0.0, 3),
        "peak_ics": round(float(np.max(ics_grid)), 3),
        "penetration_depth_m": penetration_depth_m,
        "weh_fraction_pct": round(ice_volume_fraction * 100.0, 2),
        "psr_equilibrium_temp_k": 25.0
    }
