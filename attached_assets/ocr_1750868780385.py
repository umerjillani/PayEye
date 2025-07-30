import pytesseract
import pdfplumber
import cv2
import pandas as pd
import re 
from pathlib import Path


def extract_text(file_path) -> str:
    ext = file_path.suffix.lower()
    if ext in {'.png', '.jpg', '.jpeg'}:
        return extract_from_image(file_path)
    elif ext == '.pdf':
        return extract_from_pdf(file_path)
    elif ext in {'.xls', '.xlsx'}:
        return extract_from_excel(file_path)
    return ''

def extract_from_image(image_path) -> str:
    img = cv2.imread(str(image_path)) 
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return pytesseract.image_to_string(gray)

def extract_from_pdf(pdf_path) -> str:
    text = ''
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + '\n'
    return text

def extract_from_excel(excel_path) -> str:
    data = pd.read_excel(excel_path, sheet_name=None)
    return "\n".join(df.to_string(index=False) for df in data.values())

def extract_float(text: str):
    match = re.search(r"\d+\.\d{2}\b", text)
    if match:
        return float(match.group())
    return None 

def save_ocr(text, output_dir, filename):
    output_path = Path(output_dir) / f"{filename}.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)

def perform_OCR(folder_path, output_dir):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for file_path in Path(folder_path).iterdir():
        if file_path.is_file():
            raw_text = extract_text(file_path)
            if raw_text:
                save_ocr(raw_text, output_dir, file_path.stem)
