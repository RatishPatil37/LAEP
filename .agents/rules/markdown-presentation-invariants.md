# Markdown Presentation Invariants

## 1. Complete Table Content (No Blank Cells or Empty Rows)
- Never output Markdown tables with empty cells, blank rows, or unpopulated placeholders.
- If data is absent or not applicable, provide an explicit, descriptive string:
  - Examples: `N/A`, `None`, `Explicit NaN (Out-of-Swath)`, `0.00%`, or `Not Surveyed`.
- Every table row must contain meaningful, auditable information across all columns.

## 2. Native Unicode Over Raw LaTeX Math
- In Markdown tables and general documentation, **never** use unrendered inline LaTeX math delimiters (`$...$`) unless the document is explicitly targeted for a LaTeX compiler.
- Standard Markdown previewers (GitHub GFM, VS Code, web apps) render `$^\circ$` or `$\mu\text{W}$` as raw text, which degrades readability.
- Always use standard UTF-8 Unicode symbols:
  - Degree: `°` (not `$^\circ$`)
  - Micro / Units: `µm`, `µW/(cm²·sr·µm)` (not `$\mu\text{m}$`, `$\mu\text{W}$`)
  - Subscripts / Superscripts: `θ_inc`, `σ_SC`, `σ_OC`, `R_s`, `R_g`, `km²`, `m³`
  - Greek letters: `λ`, `α`, `θ`, `σ`, `Δ`
  - Math operators: `×`, `·`, `±`, `≤`, `≥`, `√`, `→`
