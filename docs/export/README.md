# Export Documentation

This directory contains documentation for Arbor's local export workflows.

## DOCX / Google Docs workflow

- Open [`reference-style-spec.html`](./reference-style-spec.html) in a browser.
- Use it as the visual source when building a styled `reference.docx` in Google Docs or Word.
- Save the downloaded `.docx` file somewhere on your machine.
- Point Arbor's local API at that file with `ARBOR_DOCX_REFERENCE_PATH=/absolute/path/to/reference.docx`.

Arbor's DOCX export uses Pandoc on the local API side. The reference document controls the final Word/Google Docs styles for headings, body text, blockquotes, and related typography.

## Notes

- The HTML spec is documentation only; it is not used directly at runtime.
- The file was moved from `docs/reference-style-spec.html` to keep export-related material together.
- Setup automation for Pandoc/system dependencies and the broader PDF template workflow are tracked separately.
