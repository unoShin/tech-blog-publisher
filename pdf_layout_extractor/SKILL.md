---
name: pdf-layout-extractor
description: Automatically extracts figures (pictures), tables, and formulas from PDF documents using the DocLayout-YOLO model and crops them precisely with Pillow.
---

# PDF Layout Extractor Skill (pdf-layout-extractor)

This skill utilizes a State-of-the-Art (SOTA) Document Layout Analysis (DLA) model, **DocLayout-YOLO**, combined with PyTorch and Pillow to automatically detect and extract visual elements (Figures, Tables, and Formulas) from PDF files with pixel-level precision.

## 🎯 Trigger Conditions
Activate this skill whenever the user requests:
- Extracting figures, charts, diagrams, or tables from a PDF document.
- Cropping illustrations or images from a research paper/PDF file.
- Automating document layout parsing for image acquisition.

## ⚙️ Environment & Dependencies
- **Conda Environment**: `/home/unowhat/anaconda3/envs/dla-master`
- **Model Checkpoint**: `/home/unowhat/project/blog-agent/models/doclayout_yolo.pt` (DocLayNet-DocSynth300K Pre-trained YOLOv10)
- **Executable Script**: `src/extract_layout_images.py`

## 🚀 Execution Guide

To extract layout elements, run the python script using the designated Conda environment interpreter:

```bash
/home/unowhat/anaconda3/envs/dla-master/bin/python src/extract_layout_images.py <pdf_path> <out_dir>
```

### Parameters
- `<pdf_path>`: Absolute path to the source PDF document (e.g., `scratch/260405091_paper.pdf`).
- `<out_dir>`: Directory where the cropped images will be saved (e.g., `drafts/260702_02/`).

### Target Class Outputs
Cropped images are classified and named automatically:
1. **Figures (Pictures/Charts)**: `figure_page{page_num}_{idx}.png`
2. **Tables (Structured grids)**: `table_page{page_num}_{idx}.png`
3. **Formulas (Equations)**: `formula_page{page_num}_{idx}.png`

## ⚖️ Important Rules (Anti-Patterns)
- **Do NOT use standard `pdfimages`**: It fails to capture vector-graphics based charts and only extracts embedded raster assets. Always use this YOLO-based pipeline instead.
- **Auto-Cleanup**: The pipeline renders temporary high-res PNG pages in `tmp_pages` during execution, which are automatically cleaned up upon completion to save disk space.
