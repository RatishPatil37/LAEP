import json
import zipfile
import xml.etree.ElementTree as ET
import os

def extract_notebook_code(path):
    print("--- Notebook Extraction ---")
    with open(path, 'r', encoding='utf-8') as f:
        nb = json.load(f)
    code = []
    for cell in nb.get('cells', []):
        cell_source = "".join(cell.get('source', []))
        if cell.get('cell_type') == 'code':
            code.append(cell_source)
        elif cell.get('cell_type') == 'markdown':
            code.append(f'# MARKDOWN: {cell_source}')
    
    with open("notebook_code.py", "w", encoding='utf-8') as f:
        f.write("\n\n".join(code))
    print("Wrote notebook_code.py")

def extract_docx_text(path):
    print("--- DOCX Extraction ---")
    text = []
    with zipfile.ZipFile(path) as docx:
        xml_content = docx.read('word/document.xml')
        tree = ET.fromstring(xml_content)
        # The namespaces are usually {http://schemas.openxmlformats.org/wordprocessingml/2006/main}
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        for paragraph in tree.findall('.//w:p', namespaces):
            para_text = "".join([node.text for node in paragraph.findall('.//w:t', namespaces) if node.text])
            if para_text:
                text.append(para_text)
    with open("docx_text.txt", "w", encoding='utf-8') as f:
        f.write("\n".join(text))
    print("Wrote docx_text.txt")

def extract_pptx_text(path):
    print("--- PPTX Extraction ---")
    text = []
    with zipfile.ZipFile(path) as pptx:
        for item in pptx.namelist():
            if item.startswith('ppt/slides/slide') and item.endswith('.xml'):
                xml_content = pptx.read(item)
                tree = ET.fromstring(xml_content)
                namespaces = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
                slide_text = []
                for node in tree.findall('.//a:t', namespaces):
                    if node.text:
                        slide_text.append(node.text)
                if slide_text:
                    text.append(" ".join(slide_text))
    with open("pptx_text.txt", "w", encoding='utf-8') as f:
        f.write("\n\n---\n\n".join(text))
    print("Wrote pptx_text.txt")

if __name__ == '__main__':
    base_dir = r"c:\Users\patil\OneDrive - South Indian Education Society\Desktop\ISRO"
    nb_path = os.path.join(base_dir, "Lunar_ISRO_proj", "Lunar_Ice_Detection_isro.ipynb")
    docx_path = os.path.join(base_dir, "ISRO Hack.docx")
    pptx_path = os.path.join(base_dir, "ISRO BAH 2026 .pptx")
    
    extract_notebook_code(nb_path)
    extract_docx_text(docx_path)
    extract_pptx_text(pptx_path)
