export function parseJsonResponseText(text, { status = 0, contentType = '', url = '' } = {}) {
  const source = String(text ?? '').trim();
  const statusText = status ? `(HTTP ${status})` : '';
  if (!source) throw responseError('test.emptyResponse', { status: statusText });
  try { return JSON.parse(source); } catch {
    const looksHtml = /^(?:<!doctype\s+html|<html\b)/i.test(source) || contentType.includes('text/html');
    if (looksHtml) {
      throw responseError('test.htmlResponse', { status: statusText, url: url || 'the page' });
    }
    throw responseError('test.invalidJsonResponse', { status: statusText });
  }
}

function responseError(i18nKey, i18nVariables) {
  const error = new Error(i18nKey);
  error.i18nKey = i18nKey;
  error.i18nVariables = i18nVariables;
  return error;
}
