import assert from 'node:assert/strict';
import { parseJsonResponseText } from './json-response.js';

assert.deepEqual(parseJsonResponseText('{"ok":true}', {
  status: 200,
  contentType: 'application/json; charset=utf-8',
  url: '/wf1/api/node/test',
}), { ok: true });

assert.throws(() => parseJsonResponseText('<!DOCTYPE html><html></html>', {
  status: 200,
  contentType: 'text/html; charset=utf-8',
  url: '/api/node/test',
}), (error) => error.i18nKey === 'test.htmlResponse' && error.i18nVariables.url === '/api/node/test');

assert.throws(() => parseJsonResponseText('', { status: 503 }), (error) => error.i18nKey === 'test.emptyResponse' && error.i18nVariables.status === '(HTTP 503)');
assert.throws(() => parseJsonResponseText('not-json', { status: 502 }), (error) => error.i18nKey === 'test.invalidJsonResponse' && error.i18nVariables.status === '(HTTP 502)');

console.log('json response tests: all pass');
