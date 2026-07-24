import sys
import json
import base64
import fitz # PyMuPDF

def pdf_to_base64_images(pdf_path):
    doc = fitz.open(pdf_path)
    base64_images = []
    
    # Render at 150-200 DPI for good OCR quality while keeping size manageable
    zoom = 2.0
    mat = fitz.Matrix(zoom, zoom)
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert pixmap to PNG bytes
        img_bytes = pix.tobytes("png")
        
        # Convert to base64
        b64 = base64.b64encode(img_bytes).decode('utf-8')
        base64_images.append(b64)
        
    return base64_images

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No PDF path provided"}))
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    try:
        images = pdf_to_base64_images(pdf_path)
        print(json.dumps({"success": True, "images": images}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
