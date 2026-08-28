import os
import sys
import shutil
import subprocess
from PIL import Image
import torch

# Monkey patch torch.load to bypass PyTorch 2.6 weights_only strict checks
original_load = torch.load
def patched_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return original_load(*args, **kwargs)
torch.load = patched_load

from doclayout_yolo import YOLO

# DocLayNet Class Mapping (Verified from model.names)
# 0: Caption, 1: Footnote, 2: Formula, 3: List-item, 4: Page-footer, 5: Page-header, 6: Picture (Figure), 7: Section-header, 8: Table, 9: Text, 10: Title
TARGET_CLASSES = {
    6: "figure",
    8: "table",
    2: "formula"
}

def extract_layout_images(pdf_path, out_dir, model_path="models/doclayout_yolo.pt", dpi=200):
    if not os.path.exists(pdf_path):
        print(f"[-] PDF file not found: {pdf_path}")
        sys.exit(1)
        
    os.makedirs(out_dir, exist_ok=True)
    
    # Create temporary directory for rendering pages
    tmp_dir = os.path.join(os.path.dirname(out_dir), "tmp_pages")
    os.makedirs(tmp_dir, exist_ok=True)
    
    print(f"[*] Rendering PDF pages to PNG (DPI: {dpi})...")
    # Command: pdftoppm -png -r {dpi} {pdf_path} {tmp_dir}/page
    page_prefix = os.path.join(tmp_dir, "page")
    cmd = ["pdftoppm", "-png", "-r", str(dpi), pdf_path, page_prefix]
    
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"[-] pdftoppm failed: {e}")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        sys.exit(1)
        
    page_files = sorted([
        os.path.join(tmp_dir, f) for f in os.listdir(tmp_dir) 
        if f.startswith("page-") and f.endswith(".png")
    ])
    
    if not page_files:
        print("[-] No rendered pages found.")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        sys.exit(1)
        
    print(f"[+] Rendered {len(page_files)} pages successfully.")
    
    # Load YOLO Model
    print(f"[*] Loading DocLayout-YOLO model from {model_path}...")
    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"[-] Failed to load YOLO model: {e}")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        sys.exit(1)
        
    print("[+] Model loaded successfully. Starting object detection and cropping...")
    
    for idx, page_path in enumerate(page_files, start=1):
        # Run YOLO prediction
        # imgsz 1120 is the recommended size for DocLayout-YOLO
        results = model.predict(source=page_path, imgsz=1120, conf=0.25, verbose=False)
        result = results[0]
        
        if len(result.boxes) == 0:
            continue
            
        # Open source image using Pillow
        img = Image.open(page_path)
        
        # Track counts per class on this page
        class_counts = {}
        
        for box in result.boxes:
            cls_id = int(box.cls[0].item())
            
            if cls_id not in TARGET_CLASSES:
                continue
                
            cls_name = TARGET_CLASSES[cls_id]
            class_counts[cls_name] = class_counts.get(cls_name, 0) + 1
            count = class_counts[cls_name]
            
            # Box coordinates (xmin, ymin, xmax, ymax)
            xyxy = box.xyxy[0].tolist()
            xmin, ymin, xmax, ymax = map(int, xyxy)
            
            # Crop image
            cropped_img = img.crop((xmin, ymin, xmax, ymax))
            
            # Save cropped file
            out_filename = f"{cls_name}_page{idx:02d}_{count}.png"
            out_filepath = os.path.join(out_dir, out_filename)
            cropped_img.save(out_filepath)
            print(f"  [+] Saved: {out_filename} (size: {cropped_img.size})")
            
    # Clean up temporary pages directory
    shutil.rmtree(tmp_dir, ignore_errors=True)
    print(f"[+] Image extraction complete! All outputs saved to: {out_dir}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python src/extract_layout_images.py <pdf_path> <out_dir> [model_path]")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    model_path = sys.argv[3] if len(sys.argv) > 3 else "models/doclayout_yolo.pt"
    
    extract_layout_images(pdf_path, out_dir, model_path)
