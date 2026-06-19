// ─── Label Type ───────────────────────────────────────────────────────────────

export const LABEL_TYPE = Object.freeze({
  /** Label returned as a base64-encoded PDF string */
  PDF_BASE64: 'pdf_base64',
  /** Label returned as a URL pointing to a PDF file */
  PDF_URL: 'pdf_url',
  /** Label returned as a URL pointing to an image */
  IMAGE_URL: 'image_url',
  /**
   * Label returned as a URL pointing to an HTML file.
   * Used by ZR Express NEW: labels are uploaded to Azure Blob Storage
   * as individual HTML files with time-limited SAS URLs.
   */
  HTML_URL: 'html_url',
});

export function getLabelTypeLabel(type) {
  switch (type) {
    case LABEL_TYPE.PDF_BASE64:
      return 'PDF (Base64 encoded)';
    case LABEL_TYPE.PDF_URL:
      return 'PDF (URL)';
    case LABEL_TYPE.IMAGE_URL:
      return 'Image (URL)';
    case LABEL_TYPE.HTML_URL:
      return 'HTML (URL)';
    default:
      return 'Unknown';
  }
}
