import sys
import os
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat

def main():
    if len(sys.argv) < 3:
        print("Usage: python pdf_to_md_docling.py <input_pdf_path> <output_md_path>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(pdf_path):
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)
        
    try:
        print(f"Converting {pdf_path} to Markdown using Docling (CUDA)...")
        
        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options.device = "cuda"
        
        converter = DocumentConverter(
            allowed_formats=[InputFormat.PDF],
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )
        
        result = converter.convert(pdf_path)
        markdown_text = result.document.export_to_markdown()
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown_text)
            
        print(f"Successfully saved Markdown to: {output_path}")
    except Exception as e:
        print(f"Error during conversion: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
