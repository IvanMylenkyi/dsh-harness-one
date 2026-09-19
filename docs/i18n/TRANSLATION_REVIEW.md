# Translation review

Initial review scope:

- English/Chinese key parity and interpolation parity: automated.
- English shell labels: reviewed against `GLOSSARY.md`.
- Legacy DOM bridge: removed; translation now happens at explicit React render
  boundaries, so workflow content, model output, code, and document bodies are
  not mutated by a global observer.
- Local browser smoke: verified `English → 简体中文 → English`, including
  toolbar labels, language control, document title, and `document.lang`.

Remaining review gates:

- Component-by-component language review after stable-key migration.
- Native browser DOM crawl in English and Chinese.
- Pseudo-locale and narrow-layout pass.
- Second human language reviewer before release.
