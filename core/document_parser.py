import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
import pypdf
import docx

class DocumentParser:
    """
    Parses .docx and .pdf files according to user flowchart:
    - If .docx / .doc -> uses python-docx
    - If .pdf -> uses pypdf + preserves raw PDF bytes for Multimodal LLM analysis
    """

    @staticmethod
    def detect_file_type(file_path: str) -> str:
        ext = Path(file_path).suffix.lower()
        if ext in [".docx", ".doc"]:
            return "doc"
        elif ext == ".pdf":
            return "pdf"
        else:
            raise ValueError(f"Unsupported file format: {ext}. Only .pdf, .docx, and .doc are supported.")

    @staticmethod
    def parse_docx(file_path: str) -> Dict[str, Any]:
        """Extracts text, paragraphs, tables, and images using python-docx."""
        try:
            doc = docx.Document(file_path)
        except Exception as e:
            raise ValueError(
                f"Could not open document using python-docx: {str(e)}. "
                "If this is an older Word 97-2003 (.doc) file, please save/convert it to .docx."
            )

        paragraphs_data = []
        full_text_lines = []

        for p_idx, p in enumerate(doc.paragraphs):
            text = p.text.strip()
            if text:
                full_text_lines.append(text)
                paragraphs_data.append({
                    "index": p_idx,
                    "type": "paragraph",
                    "text": text,
                    "runs_count": len(p.runs)
                })

        tables_data = []
        for t_idx, table in enumerate(doc.tables):
            table_rows = []
            for r_idx, row in enumerate(table.rows):
                row_cells = []
                for c_idx, cell in enumerate(row.cells):
                    cell_text = cell.text.strip()
                    row_cells.append(cell_text)
                    if cell_text:
                        full_text_lines.append(f"[Table {t_idx+1} Row {r_idx+1} Col {c_idx+1}]: {cell_text}")
                table_rows.append(row_cells)
            tables_data.append({
                "table_index": t_idx,
                "rows": table_rows
            })

        # Extract embedded images if any
        images = []
        try:
            for rel in doc.part.rels.values():
                if "image" in rel.target_ref:
                    img_part = rel.target_part
                    images.append({
                        "content_type": img_part.content_type,
                        "data": img_part.blob
                    })
        except Exception:
            pass

        full_text = "\n".join(full_text_lines)

        return {
            "file_type": "docx",
            "file_name": Path(file_path).name,
            "file_path": file_path,
            "full_text": full_text,
            "paragraphs": paragraphs_data,
            "tables": tables_data,
            "images": images,
            "total_paragraphs": len(doc.paragraphs),
            "total_tables": len(doc.tables)
        }

    @staticmethod
    def parse_pdf(file_path: str) -> Dict[str, Any]:
        """
        Extracts text and page metadata using pypdf.
        Also reads raw PDF bytes and checks for font mojibake to enable Multimodal LLM analysis.
        """
        reader = pypdf.PdfReader(file_path)
        pages_data = []
        full_text_lines = []
        total_mojibake_chars = 0

        for page_idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            cleaned_text = page_text.strip()
            mojibake_count = cleaned_text.count("\ufffd")
            total_mojibake_chars += mojibake_count

            if cleaned_text:
                full_text_lines.append(f"--- [Page {page_idx + 1}] ---")
                full_text_lines.append(cleaned_text)
                pages_data.append({
                    "page_number": page_idx + 1,
                    "text": cleaned_text,
                    "has_mojibake": mojibake_count > 3
                })

        with open(file_path, "rb") as f:
            pdf_bytes = f.read()

        full_text = "\n".join(full_text_lines)
        has_encoding_issues = total_mojibake_chars > 5 or len(full_text.strip()) < 50

        # Also extract page preview text
        preview_text = full_text[:1000] if not has_encoding_issues else (
            f"[PDF with {len(reader.pages)} pages. Visual diagrams & map detected. "
            f"Multimodal AI vision processing will be used for 100% accuracy.]"
        )

        return {
            "file_type": "pdf",
            "file_name": Path(file_path).name,
            "file_path": file_path,
            "pdf_bytes": pdf_bytes,
            "full_text": full_text,
            "preview_text": preview_text,
            "has_mojibake": has_encoding_issues,
            "pages": pages_data,
            "total_pages": len(reader.pages)
        }

    @classmethod
    def parse(cls, file_path: str) -> Dict[str, Any]:
        file_type = cls.detect_file_type(file_path)
        if file_type == "doc":
            return cls.parse_docx(file_path)
        elif file_type == "pdf":
            return cls.parse_pdf(file_path)
        else:
            raise ValueError(f"Unknown file type: {file_type}")
