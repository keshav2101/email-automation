"""
Resume parser: extracts raw text from PDF, DOCX, DOC, TXT, RTF, and MD files.
"""
import os
import re
import fitz  # PyMuPDF
from docx import Document


def parse_resume(file_path: str, file_type: str) -> str:
    """Extract raw text from any uploaded document file."""
    ft = (file_type or "").lower().strip(".")
    if ft == "pdf":
        return _parse_pdf(file_path)
    elif ft == "docx":
        return _parse_docx(file_path)
    elif ft in ("txt", "md"):
        return _parse_text(file_path)
    elif ft in ("doc", "rtf"):
        return _parse_doc_or_rtf(file_path)
    else:
        # Fallback generic text reader
        return _parse_text(file_path)


def _parse_pdf(file_path: str) -> str:
    """Extract text from PDF using PyMuPDF with fallbacks."""
    try:
        doc = fitz.open(file_path)
        text_parts = []
        for page in doc:
            text = page.get_text()
            if text:
                text_parts.append(text)
        doc.close()
        combined = "\n".join(text_parts).strip()
        if combined:
            return combined
    except Exception as e:
        pass

    # Fallback to binary string extraction if normal text stream is empty
    return _parse_text(file_path)


def _parse_docx(file_path: str) -> str:
    """Extract text from DOCX using python-docx."""
    try:
        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
        # Also check tables in docx
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    paragraphs.append(row_text)
        return "\n".join(paragraphs).strip()
    except Exception as e:
        # Fallback to raw text extraction
        return _parse_text(file_path)


def _parse_text(file_path: str) -> str:
    """Read plain text, markdown, or unstructured document files with multiple encodings."""
    for encoding in ("utf-8", "utf-8-sig", "latin-1", "cp1252", "ascii"):
        try:
            with open(file_path, "r", encoding=encoding, errors="replace") as f:
                content = f.read()
                # Clean non-printable characters
                cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", content)
                if cleaned.strip():
                    return cleaned.strip()
        except Exception:
            continue
    return ""


def _parse_doc_or_rtf(file_path: str) -> str:
    """Attempt extraction from older .doc or .rtf files using regex string patterns."""
    try:
        with open(file_path, "rb") as f:
            raw = f.read()
        # Extract ASCII / printable unicode sequences of length >= 4
        words = re.findall(rb"[\x20-\x7E]{4,}", raw)
        decoded = "\n".join(w.decode("latin-1", errors="ignore") for w in words)
        if len(decoded.strip()) > 50:
            return decoded.strip()
    except Exception:
        pass
    return _parse_text(file_path)
