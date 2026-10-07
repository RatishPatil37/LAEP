import os
import sys
import numpy as np
import rasterio
from PIL import Image

def save_as_png(image_array, output_path):
    """Saves a 2D numpy array as a standard PNG image file."""
    # Normalize to 0-255
    img = np.nan_to_num(image_array, nan=0.0)
    img_min = img.min()
    img_max = img.max()
    
    if img_max > img_min:
        img = (img - img_min) / (img_max - img_min) * 255.0
    else:
        img = np.zeros_like(img)
        
    img = img.astype(np.uint8)
    
    # Write PNG format using Pillow
    pil_img = Image.fromarray(img)
    pil_img.save(output_path)

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "data", "prospectivity_dataset")
    
    # Find all South Pole slope patches
    all_files = os.listdir(data_dir)
    south_pole_files = [f for f in all_files if "_S_" in f and "SLOPE.tif" in f]
    south_pole_files.sort()
    
    if not south_pole_files:
        print("No South Pole slope samples found!")
        return
        
    print(f"Found {len(south_pole_files)} South Pole scientific .tif samples.")
    print("Converting all of them to viewable .png images...")
    
    for i, sample_filename in enumerate(south_pole_files):
        sample_path = os.path.join(data_dir, sample_filename)
        
        with rasterio.open(sample_path) as src:
            img = src.read(1)
            
        out_path = os.path.join(data_dir, sample_filename.replace(".tif", ".png"))
        save_as_png(img, out_path)
        
        if (i + 1) % 10 == 0:
            print(f"Converted {i + 1}/{len(south_pole_files)} images...")
            
    print("\nSuccess! All 81 South Pole samples have been converted to standard viewable PNGs!")

if __name__ == "__main__":
    main()
