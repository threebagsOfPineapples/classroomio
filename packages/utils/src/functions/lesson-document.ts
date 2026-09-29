export function isPdfDocument(document: { type: string; name: string }): boolean {
  const mimeType = document.type.split(';')[0].trim().toLowerCase();
  return mimeType === 'pdf' || mimeType === 'application/pdf' || /\.pdf$/i.test(document.name.trim());
}
