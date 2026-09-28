const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || '')
  : '';

export function getFileExtension(filePath) {
  return filePath.split('.').pop().toLowerCase();
}

export function getFileName(filePath) {
  return filePath.split('/').pop();
}

export function getViewApiUrl(filePath) {
  const encoded = filePath.split('/').map(encodeURIComponent).join('/');
  return `${API_BASE}/api/view/${encoded}`;
}

export function getViewerPath(filePath, itemId = '') {
  const params = new URLSearchParams({ doc: filePath });
  if (itemId) params.set('item', itemId);
  return `/view?${params.toString()}`;
}

export function getDocumentType(filePath) {
  const ext = getFileExtension(filePath);
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  if (['doc', 'docx'].includes(ext)) return 'docx';
  if (['ppt', 'pptx'].includes(ext)) return 'pptx';
  if (ext === 'svg') return 'image';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  return 'unknown';
}

// Legacy alias — now points to view-only API
export function getDocumentUrl(filePath) {
  return getViewApiUrl(filePath);
}
