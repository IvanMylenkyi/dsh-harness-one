import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let failed = false;

function run(command, args, cwd = here) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) {
    console.error(`Failed to start ${command}: ${result.error.message}`);
    failed = true;
  } else if (result.status !== 0) {
    failed = true;
  }
  return result.status === 0;
}

run(process.execPath, ['scripts/check-i18n.mjs']);

const suites = [
  ['web/src', '*.test.mjs'],
  ['dsh-plugins/dsh-ccpg-orchestrator/test', '*.test.mjs'],
  ['dsh-plugins/dsh-ccpg-llm-guard/test', '*.test.mjs'],
  ['dsh-plugins/dsh-ccpg-canvasui/test', '*.test.mjs'],
  ['dsh-plugins/dsh-ccpg-larkauth/test', '*.test.mjs'],
  ['dsh-plugins/dsh-ccpg-one/test', '*.test.mjs'],
];

// The package's React entry is a generated Vite artifact and is intentionally
// not committed. Build it before the browser suite so a clean checkout works.
run(npm, ['--prefix', 'dsh-plugins/dsh-ccpg-document-preview', 'run', 'build']);

for (const [relativeDir, pattern] of suites) {
  const dir = resolve(here, relativeDir);
  const files = (await import('node:fs')).readdirSync(dir)
    .filter((file) => file.endsWith('.test.mjs'))
    .sort();
  for (const file of files) run(process.execPath, [resolve(dir, file)]);
}

run(npm, ['--prefix', 'dsh-plugins/dsh-ccpg-document-preview', 'test', '--silent']);

if (failed) {
  console.error('Some test suites failed');
  process.exit(1);
}
console.log('All test suites passed');
