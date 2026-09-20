import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cjk = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const sourceRoots = ['web/src', 'dsh-plugins', 'server'];
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.html']);
const baselinePath = path.join(root, 'docs', 'i18n', 'CJK_BASELINE.json');
const stableKey = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/;

function normalizedPath(file) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isSourceFile(file) {
  const normalized = normalizedPath(file);
  if (!sourceRoots.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) return false;
  if (!sourceExtensions.has(path.extname(normalized))) return false;
  // Most plugin lib/ trees are generated server artifacts. The larkauth
  // browser entry is different: lib/client.js is the shipped source bundle,
  // so keep it in the first-party UI scan and protect its marked dictionary.
  if (/(^|\/)(node_modules|dist|web-dist|coverage|lib)(\/|$)/.test(normalized)
    && normalized !== 'dsh-plugins/dsh-ccpg-larkauth/lib/client.js') return false;
  if (/(^|\/)(__tests__|test|tests)(\/|$)/.test(normalized) || /(?:\.test|\.spec)\.[^.]+$/.test(normalized)) return false;
  if (normalized.startsWith('web/src/i18n/')) return false;
  if (normalized === 'dsh-plugins/dsh-ccpg-document-preview/src/i18n.js') return false;
  return true;
}

function stripComments(line, state) {
  let result = '';
  let index = 0;
  while (index < line.length) {
    if (state.block) {
      const end = line.indexOf('*/', index);
      if (end < 0) return '';
      state.block = false;
      index = end + 2;
      continue;
    }
    const blockStart = line.indexOf('/*', index);
    const htmlStart = line.indexOf('<!--', index);
    const lineStart = line.indexOf('//', index);
    const starts = [blockStart, htmlStart, lineStart].filter((value) => value >= 0);
    const next = starts.length ? Math.min(...starts) : -1;
    if (next < 0) {
      result += line.slice(index);
      break;
    }
    result += line.slice(index, next);
    if (next === lineStart) break;
    if (next === htmlStart) {
      const end = line.indexOf('-->', next + 4);
      if (end < 0) break;
      index = end + 3;
    } else {
      const end = line.indexOf('*/', next + 2);
      if (end < 0) {
        state.block = true;
        break;
      }
      index = end + 2;
    }
  }
  return result;
}

function scanContent(content, file, { checkKeys = true } = {}) {
  const findings = [];
  const invalidKeys = [];
  const state = { block: false };
  for (const [index, original] of String(content).split(/\r?\n/).entries()) {
    if (original.includes('@i18n-dictionary:start')) {
      state.dictionary = true;
      continue;
    }
    if (state.dictionary) {
      if (original.includes('@i18n-dictionary:end')) state.dictionary = false;
      continue;
    }
    const line = stripComments(original, state);
    if (checkKeys) {
      const calls = line.matchAll(/\b(?:t|tx)\s*\(\s*(['"`])([^'"`]*)\1/g);
      for (const match of calls) {
        if (!stableKey.test(match[2])) {
          invalidKeys.push({
            file: normalizedPath(file),
            line: index + 1,
            text: `translation call must use a stable key: ${match[2]}`,
          });
        }
      }
    }
    const untranslated = line.replace(/\b(?:t|tx)\s*\((?:[^()'\"]|'[^']*'|\"[^\"]*\")*\)/g, '');
    if (!cjk.test(untranslated)) continue;
    // Remove only complete explicit translation calls. Raw CJK elsewhere on
    // the same line must still be reported instead of being hidden by t(...).
    const text = untranslated.trim();
    if (!text) continue;
    findings.push({ file: normalizedPath(file), line: index + 1, text, hash: hash(text) });
  }
  return { findings, invalidKeys };
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function walkSources() {
  const files = [];
  const visit = (relative) => {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) return;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(full)) visit(path.join(relative, entry));
    } else if (isSourceFile(relative)) files.push(relative);
  };
  for (const sourceRoot of sourceRoots) visit(sourceRoot);
  return files.sort();
}

function scanWorkingTree() {
  return walkSources().reduce((result, file) => {
    const scanned = scanContent(fs.readFileSync(path.join(root, file), 'utf8'), file);
    result.findings.push(...scanned.findings);
    result.invalidKeys.push(...scanned.invalidKeys);
    return result;
  }, { findings: [], invalidKeys: [] });
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function scanGitRef(ref) {
  const files = git(['ls-tree', '-r', '--name-only', ref]).split(/\r?\n/).filter(isSourceFile);
  return files.flatMap((file) => scanContent(git(['show', `${ref}:${file}`]), file, { checkKeys: false }).findings);
}

function baselineRef() {
  const explicitIndex = process.argv.indexOf('--baseline-ref');
  if (explicitIndex >= 0 && process.argv[explicitIndex + 1]) return process.argv[explicitIndex + 1];
  try { return git(['rev-parse', 'upstream/main']); } catch {}
  try { return git(['rev-parse', 'HEAD']); } catch { return null; }
}

function writeBaseline() {
  const ref = baselineRef();
  if (!ref) throw new Error('Unable to resolve a baseline ref. Use --baseline-ref <commit>.');
  const findings = scanGitRef(ref);
  const files = {};
  for (const finding of findings) (files[finding.file] ||= []).push(finding.hash);
  for (const hashes of Object.values(files)) hashes.sort();
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify({ version: 1, baselineRef: ref, files }, null, 2)}\n`);
  console.log(`i18n baseline written from ${ref}: ${findings.length} CJK source fragments.`);
}

function checkSource() {
  if (!fs.existsSync(baselinePath)) {
    return { error: `missing ${normalizedPath(path.relative(root, baselinePath))}; run node scripts/check-i18n.mjs --write-baseline` };
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const knownByFile = baseline.files || {};
  const current = scanWorkingTree();
  return {
    findings: current.findings.filter((finding) => !knownByFile[finding.file]?.includes(finding.hash)),
    invalidKeys: current.invalidKeys,
  };
}

function checkBundle() {
  const assets = path.join(root, 'web', 'dist', 'assets');
  if (!fs.existsSync(assets)) return [];
  return fs.readdirSync(assets)
    .filter((file) => file.endsWith('.js'))
    .filter((file) => cjk.test(fs.readFileSync(path.join(assets, file), 'utf8')))
    .map((file) => `web/dist/assets/${file}`);
}

if (process.argv.includes('--write-baseline')) {
  writeBaseline();
  process.exit(0);
}

const source = checkSource();
const bundle = process.argv.includes('--strict') ? checkBundle() : [];
const errors = [];
if (source.error) errors.push(source.error);
for (const finding of source.invalidKeys || []) errors.push(`${finding.file}:${finding.line}: ${finding.text}`);
for (const finding of source.findings || []) errors.push(`${finding.file}:${finding.line}: ${finding.text}`);
for (const file of bundle) errors.push(`${file}: bundled CJK detected`);

if (errors.length) {
  console.error('i18n check failed. New first-party CJK must use a stable translation key; strict mode also scans the production bundle.');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`i18n check passed: source baseline protected${process.argv.includes('--strict') ? '; bundle scan passed' : ''}.`);
