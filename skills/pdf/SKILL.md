---
name: pdf
description: Extract and process text from PDF documents
tags: document, data-extraction
triggers: pdf, document, extract, parse
---

# PDF Processing Skill

## Purpose
Extract structured text content from PDF files using OCR and parsing.

## Process

1. **Document Analysis**
   - Check PDF structure
   - Identify text vs image content
   - Detect scanned pages

2. **Text Extraction**
   - Extract native PDF text
   - Run OCR on image pages
   - Preserve layout information

3. **Structure Recognition**
   - Identify headings
   - Detect tables
   - Extract lists
   - Find images/charts

4. **Output Generation**
   - Convert to clean markdown
   - Preserve document hierarchy
   - Include metadata

## Tools Available

- `extract_pdf_text`: Extract text from PDF
- `ocr_pdf_page`: OCR a specific page
- `parse_pdf_structure`: Analyze document structure

## Output Format

```markdown
# {Document Title}

## Metadata
- Pages: {count}
- Author: {author}
- Created: {date}

## Content
...
```
