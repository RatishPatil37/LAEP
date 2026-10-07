import os
import pandas as pd
import rasterio
import numpy as np

from rasterio.warp import transform_bounds

from pyproj import CRS

def get_tif_bounds(tif_path):
    """Extracts the spatial bounding box (min_lon, min_lat, max_lon, max_lat) from a NASA .tif file and converts to standard GPS."""
    with rasterio.open(tif_path) as src:
        # Get the planetary geodetic CRS (Moon Lat/Lon) from the projected CRS
        proj_crs = CRS.from_string(src.crs.to_wkt())
        geo_crs = proj_crs.geodetic_crs
        
        # Convert from the NASA Polar projection to standard Lat/Lon degrees
        min_lon, min_lat, max_lon, max_lat = transform_bounds(src.crs, geo_crs, *src.bounds)
        return {
            "min_lon": min_lon,
            "max_lon": max_lon,
            "min_lat": min_lat,
            "max_lat": max_lat
        }

def club_datasets():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 1. Load the Custom Chandrayaan-2 ML Ready Dataset
    custom_csv_path = r"C:\Users\Samar Manoj. Shahane\Desktop\laep nasa\F2_ml_ready_dataset.csv"
    print(f"Loading custom dataset from: {custom_csv_path}")
    df_custom = pd.read_csv(custom_csv_path)
    
    # 2. Load the 81 NASA Context Vectors we generated
    nasa_csv_path = os.path.join(base_dir, "data", "south_pole_training_dataset.csv")
    df_nasa = pd.read_csv(nasa_csv_path)
    
    # 3. Get the list of all 81 original NASA .tif files to extract their spatial bounds
    tif_dir = os.path.join(base_dir, "data", "prospectivity_dataset")
    tif_files = sorted([f for f in os.listdir(tif_dir) if f.endswith("SLOPE.tif")])
    
    merged_records = []
    
    print("\nPerforming Spatial Join (Mapping Custom Data to NASA Regions)...")
    for index, tif_file in enumerate(tif_files):
        tif_path = os.path.join(tif_dir, tif_file)
        
        # A. Get the physical Latitude/Longitude boundaries of this specific NASA crater patch
        bounds = get_tif_bounds(tif_path)
        
        # B. Find all rows in your Custom CSV that fall INSIDE this crater patch
        # (Conceptual spatial filter)
        matching_rows = df_custom[
            (df_custom['Latitude_deg_SAR'] >= bounds['min_lat']) &
            (df_custom['Latitude_deg_SAR'] <= bounds['max_lat']) &
            (df_custom['Longitude_deg_SAR'] >= bounds['min_lon']) &
            (df_custom['Longitude_deg_SAR'] <= bounds['max_lon'])
        ]
        
        # C. If we found matching Chandrayaan-2 data inside this NASA patch, club them together!
        if not matching_rows.empty:
            # Get the 256-D NASA Vector for this patch
            nasa_vector = df_nasa.iloc[index].to_dict()
            
            # Combine the NASA Context with every custom physical reading found here
            for _, custom_row in matching_rows.iterrows():
                combined_row = {**custom_row.to_dict(), **nasa_vector}
                merged_records.append(combined_row)
                
    # 4. Save the fully clubbed Master Dataset
    if merged_records:
        df_master = pd.DataFrame(merged_records)
        output_path = os.path.join(base_dir, "data", "MASTER_FUSED_DATASET.csv")
        df_master.to_csv(output_path, index=False)
        print(f"\nSuccess! Datasets clubbed based on Spatial Coordinates.")
        print(f"Saved to: {output_path}")
    else:
        print("\nNote: The coordinate systems need CRS reprojection to perfectly align.")

if __name__ == "__main__":
    club_datasets()
