# Textbooks (Markdown)

All 37 Tanzanian primary textbooks (Grades 1–5), OCR'd to Markdown with
**Gemini 3.5 Flash**. 4,040 pages, 0 page-errors.

## Layout

```
Textbooks_Markdown/
  INDEX.md                       ← list of every book + page count
  Grade_1/ … Grade_5/
    <Subject>.md                 ← the textbook text, page by page
    <Subject>.index.json         ← chapters, titles, and page ranges
```

## Reading a `<Subject>.md`

Each page is delimited and carries **two** page numbers:

```markdown
--- PAGE 7 ---        ← scan page (the 7th sheet in the PDF; always sequential)
<!--folio:1-->        ← printed page (the "1" actually printed in the book)
# Chapter One         ← chapter / section titles are Markdown headings
...text...
[diagram: 6 oranges]  ← pictures are described, not transcribed
| a | b |             ← tables are real Markdown tables
```

- **scan page** = navigate the file. **folio** = the page number a teacher/pupil sees.
- The first line of each file (`<!-- engine: ... -->`) records which OCR engine produced it.

## Jumping to a chapter — `<Subject>.index.json`

```json
{
  "confidence": "high",
  "offset": 7,                      // printed page + 7 = scan page (when uniform)
  "total_pages": 63,
  "page_map": [{"scan": 1, "printed": 1}, ...],   // exact scan<->printed for every page
  "chapters": [
    {"n": 1, "title": "Counting numbers",
     "scan_start": 8, "scan_end": 12,             // where to read in the .md
     "printed_start": 1, "printed_end": 5}        // what the book calls those pages
  ]
}
```

Use `scan_start`/`scan_end` to pull just one chapter's pages from the `.md`
without reading the whole book.

## Regenerating

From the repo root:

```
PYTHONPATH=. python -m scripts.ocr_corpus_gemini   # OCR source PDFs -> cache/
PYTHONPATH=. python -m scripts.publish_ocr --once  # cache/ -> here + INDEX.md
PYTHONPATH=. python -m scripts.build_indexes       # (re)build the .index.json files
```

Source PDFs live in `downloads/Textbooks/Grade_N/`.
