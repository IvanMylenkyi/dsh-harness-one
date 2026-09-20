import { createPreviewTranslator, resolvePreviewLocale } from './i18n.js';

export const MIME_BY_EXTENSION = Object.freeze({
  avif: 'image/avif', csv: 'text/csv', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  gif: 'image/gif', html: 'text/html', htm: 'text/html', jpeg: 'image/jpeg', jpg: 'image/jpeg',
  json: 'application/json', log: 'text/plain', md: 'text/markdown', mdown: 'text/markdown',
  pdf: 'application/pdf', png: 'image/png', ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain',
  univer: 'application/x-univer', webp: 'image/webp', xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

const KIND_BY_MIME = Object.freeze({
  'application/json': 'json',
  'application/pdf': 'pdf',
  'application/vnd.ms-excel': 'sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/x-univer': 'univer',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/markdown': 'markdown',
  'text/plain': 'text',
});

const IMAGE_MIMES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const LEGACY_EXTENSIONS = new Set(['doc', 'ppt']);

function baseMime(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

export function documentExtension(name) {
  const leaf = String(name || '').split(/[\\/]/).pop() || '';
  const dot = leaf.lastIndexOf('.');
  return dot > -1 ? leaf.slice(dot + 1).toLowerCase() : '';
}

export function documentMimeType(name, mimeType) {
  return baseMime(mimeType) || MIME_BY_EXTENSION[documentExtension(name)] || '';
}

export function documentPreviewKind(name, mimeType) {
  const extension = documentExtension(name);
  if (LEGACY_EXTENSIONS.has(extension)) return null;
  const mime = documentMimeType(name, mimeType);
  if (mime === 'application/msword' || mime === 'application/vnd.ms-powerpoint') return null;
  if (IMAGE_MIMES.has(mime)) return 'image';
  return KIND_BY_MIME[mime] || null;
}

export function canPreviewDocument(document) {
  return Boolean(document && documentPreviewKind(document.name, document.mimeType));
}

export function normalizePreviewDocument(document) {
  if (!document || typeof document !== 'object') throw new TypeError('document is required');
  const name = String(document.name || 'document');
  const mimeType = documentMimeType(name, document.mimeType);
  return {
    ...document,
    name,
    mimeType,
    previewUrl: document.previewUrl || document.url || '',
    downloadUrl: document.downloadUrl || document.url || document.previewUrl || '',
  };
}

export function previewErrorDescriptor(reason) {
  if (reason?.name === 'AbortError') return { key: null };
  if (reason?.code === 'preview-url-missing') return { key: 'error.missingUrl' };
  if (reason?.code === 'preview-network-error') return { key: 'error.network' };
  if (reason?.code === 'preview-size') return { key: 'error.size', variables: { kind: reason.kind || 'Document', size: reason.size } };
  if (reason?.code === 'univer-gateway-failed') return { key: 'univer.gatewayFailed' };
  if (reason?.code === 'univer-path-failed') return { key: 'univer.pathFailed' };
  if (reason?.status === 404 || reason?.code === 'preview-not-found') return { key: 'error.notFound' };
  if (reason?.status === 409 || reason?.code === 'preview-session-required') return { key: 'error.session' };
  if (reason?.status >= 500) return { key: 'error.service' };
  const raw = String(reason?.message || reason || '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) return { key: 'error.network' };
  return raw ? { raw } : { key: 'error.generic' };
}

export function previewErrorMessage(reason, locale = 'en') {
  const descriptor = previewErrorDescriptor(reason);
  if (descriptor.key === null) return '';
  if (descriptor.raw) return descriptor.raw;
  return createPreviewTranslator(resolvePreviewLocale(locale))(descriptor.key, descriptor.variables);
}

export async function fetchPreviewResponse(url, options = {}) {
  if (!url) {
    const error = new Error('Preview URL is missing');
    error.code = 'preview-url-missing';
    throw error;
  }
  let response;
  try {
    response = await fetch(url, { credentials: 'same-origin', ...options });
  } catch (reason) {
    if (reason?.name === 'AbortError') throw reason;
    const error = new Error(previewErrorMessage(reason));
    error.code = 'preview-network-error';
    error.cause = reason;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(previewErrorMessage({ status: response.status }));
    error.status = response.status;
    error.code = response.status === 404 ? 'preview-not-found' : response.status === 409 ? 'preview-session-required' : 'preview-http-error';
    throw error;
  }
  return response;
}

export async function loadPreviewText(url, options = {}) {
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const response = await fetchPreviewResponse(url, { signal: options.signal });
  const declaredSize = Number(response.headers.get('content-length') || 0);
  const size = Math.ceil(maxBytes / 1024 / 1024);
  if (declaredSize > maxBytes) {
    const error = new Error(`Text preview exceeds ${size}MB`);
    error.code = 'preview-size'; error.kind = 'Text'; error.size = size;
    throw error;
  }
  const text = await response.text();
  if (new Blob([text]).size > maxBytes) {
    const error = new Error(`Text preview exceeds ${size}MB`);
    error.code = 'preview-size'; error.kind = 'Text'; error.size = size;
    throw error;
  }
  return text;
}

export async function loadPreviewArrayBuffer(url, options = {}) {
  const maxBytes = options.maxBytes ?? 50 * 1024 * 1024;
  const response = await fetchPreviewResponse(url, { signal: options.signal });
  const declaredSize = Number(response.headers.get('content-length') || 0);
  const size = Math.ceil(maxBytes / 1024 / 1024);
  if (declaredSize > maxBytes) {
    const error = new Error(`Document preview exceeds ${size}MB`);
    error.code = 'preview-size'; error.kind = 'Document'; error.size = size;
    throw error;
  }
  const data = await response.arrayBuffer();
  if (data.byteLength > maxBytes) {
    const error = new Error(`Document preview exceeds ${size}MB`);
    error.code = 'preview-size'; error.kind = 'Document'; error.size = size;
    throw error;
  }
  return data;
}

export function createDocumentPreviewHost() {
  return {
    name: 'dsh-ccpg-document-preview',
    supports: (document) => canPreviewDocument(document),
    kind: (document) => documentPreviewKind(document?.name, document?.mimeType),
    normalize: normalizePreviewDocument,
  };
}
