export function isPdfDocument(document: { type: string; name: string }): boolean {
  const mimeType = document.type.split(';')[0].trim().toLowerCase();
  return mimeType === 'pdf' || mimeType === 'application/pdf' || /\.pdf$/i.test(document.name.trim());
}

export function getLessonDocumentIdentity(document: { key?: string | null; assetId?: string | null }): string | null {
  const storageKey = document.key;
  if (storageKey?.trim()) return storageKey;

  const assetId = document.assetId?.trim();
  return assetId ? `asset:${assetId}` : null;
}

export function getPdfReadingResource(document: {
  type: string;
  name: string;
  key?: string | null;
  assetId?: string | null;
}): string | null {
  if (!isPdfDocument(document)) return null;

  const identity = getLessonDocumentIdentity(document);
  return identity ? `pdf:${identity}` : null;
}
