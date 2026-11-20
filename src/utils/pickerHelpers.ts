export interface PickedDriveItem {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  parentId?: string;
  isFolder: boolean;
}

/**
 * Resolves the top-level frame origin required by Google Picker when rendered
 * inside an embedded iframe (uses last ancestorOrigin, falling back to window.origin).
 */
export function resolvePickerOrigin(
  ancestorOrigins: ArrayLike<string> | null | undefined,
  currentOrigin: string
): string {
  if (ancestorOrigins && ancestorOrigins.length > 0) {
    const topOrigin = ancestorOrigins[ancestorOrigins.length - 1];
    if (topOrigin && topOrigin !== 'null') {
      return topOrigin;
    }
  }
  return currentOrigin;
}

/**
 * Safely normalizes a raw document object returned by Google Picker's callback.
 */
export function normalizePickedDocument(raw: Record<string, unknown> | null | undefined): PickedDriveItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;

  const name =
    typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name.trim() : '未命名云端文档';
  const mimeType = typeof raw.mimeType === 'string' ? raw.mimeType : '';
  const url = typeof raw.url === 'string' && raw.url.trim().length > 0 ? raw.url.trim() : undefined;
  const parentId =
    typeof raw.parentId === 'string' && raw.parentId.trim().length > 0
      ? raw.parentId.trim()
      : undefined;

  return {
    id,
    name,
    mimeType,
    url,
    parentId,
    isFolder: mimeType === 'application/vnd.google-apps.folder',
  };
}

/**
 * Truncates long imported Drive document content cleanly for interactive AI study.
 */
export function truncateStudyMaterial(
  text: string,
  maxChars = 3200
): { text: string; truncated: boolean; originalLength: number } {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (cleaned.length <= maxChars) {
    return { text: cleaned, truncated: false, originalLength: cleaned.length };
  }
  const sliced = cleaned.slice(0, maxChars).trimEnd();
  return {
    text: `${sliced}\n\n（注：原文较长，已截取前 ${maxChars} 字符供精读学习）`,
    truncated: true,
    originalLength: cleaned.length,
  };
}
