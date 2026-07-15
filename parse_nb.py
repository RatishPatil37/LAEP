import json
import nbformat

def extract_notebook_code():
    nb = nbformat.read(r"c:\Users\patil\OneDrive - South Indian Education Society\Desktop\ISRO\Lunar_ISRO_proj\Lunar_Ice_Detection_isro.ipynb", as_version=4)
    code = []
    for cell in nb.cells:
        if cell.cell_type == 'code':
            code.append(cell.source)
        elif cell.cell_type == 'markdown':
            code.append(f'# MARKDOWN: {cell.source}')
    
    with open(r"c:\Users\patil\OneDrive - South Indian Education Society\Desktop\ISRO\notebook_code.py", "w", encoding='utf-8') as f:
        f.write("\n\n".join(code))

if __name__ == '__main__':
    extract_notebook_code()
