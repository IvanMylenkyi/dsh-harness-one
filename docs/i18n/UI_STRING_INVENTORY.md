# Workflow One UI string inventory

Audit baseline: `upstream/main` at the current roadmap baseline. This inventory
tracks first-party UI copy only. Comments, compatibility dictionaries,
user-authored workflow names/prompts/node labels, filenames, document bodies,
model output, server-provided error text, code, and the supported `/变量`
command are excluded from migration scope.

| Surface | Current status | Concrete files and remaining gaps | Verification |
| --- | --- | --- | --- |
| Application shell and canvas chrome | Migrated in this batch | `web/src/App.jsx`, `web/src/ui.jsx`; stable keys now cover navigation, toolbar, runtime badge, canvas progress, command bar, edge inspector, resume modal, lint bar, error/toast wrappers, placeholders, and ARIA labels. | `i18n-browser.spec.mjs`: both language directions, modal, toast, empty run status, lint error |
| Node editors | Migrated for audited UI chrome | `web/src/NodePanel.jsx`, `web/src/AgentSchemaEditor.jsx`, and `web/src/RichDocEditor.jsx` use stable keys for labels, empty/validation states, toolbar titles, prompts, and ARIA text. `web/src/ScriptCodeEditor.jsx` has no remaining CJK UI literal in the audit. | `editors-browser.spec.mjs`: schema empty/invalid states, RichDoc toolbar, and both language directions |
| Workflow library and templates | Migrated for modal chrome | `web/src/WorkflowList.jsx`, `web/src/TemplateEditor.jsx`, and the `TemplateModal` chrome in `web/src/templates.jsx` use stable keys. Seed graph labels/prompts remain intentional template content and are not translated. | `editors-browser.spec.mjs`; workflow-list/template tests |
| Runs and recovery | Migrated for audited fallback paths | `web/src/RunHistory.jsx`, `web/src/RunSwitcher.jsx`, `web/src/TestRunModal.jsx`, and `web/src/result-adapter.js` use stable keys/descriptors for first-party status, duration, loading, and response errors. Server errors and run output remain data. | ResultPanel and feedback browser smoke; result-adapter/json-response tests |
| Results and document wall | Migrated | `web/src/ResultPanel.jsx`, `web/src/ResultViewer.jsx`, `web/src/DocWallView.jsx`, `web/src/ArtifactPreview.jsx`, and `web/src/MarkdownDocument.jsx` use stable keys for UI chrome. Dynamic documents, filenames, links, and model output remain data. | ResultPanel and DocWall tests; parity/scanner/build pass |
| Settings and scheduled work | Migrated for audited fallback paths | `web/src/FeishuCredModal.jsx`, `web/src/VariableCenter.jsx`, `web/src/ScheduleCenter.jsx`, `web/src/global-variables.js`, `web/src/variables.js`, and `web/src/schedule-center.js` use stable keys/descriptors for labels, fallback errors, validation, and cron descriptions. | Settings/schedule unit tests; variable fallback and cron descriptor coverage |
| Feedback and rich document editing | Migrated for audited drawer/editor chrome | `web/src/docwall-feedback.jsx` and `web/src/RichDocEditor.jsx` use stable keys for modal-adjacent controls, empty, validation, revision, accessibility, and editor-toolbar copy. Document names, comment bodies, revision summaries, and server errors remain data. | `feedback-browser.spec.mjs` and `editors-browser.spec.mjs` cover both language directions |
| Cross-cutting adapters and validation | Migrated for first-party fallback boundary | `web/src/json-response.js`, `web/src/workflow-serialization.js`, `web/src/patch-confirm.js`, `web/src/result-adapter.js`, and variable validation return stable error/status descriptors; React callers localize descriptors and preserve server-provided text. | Unit contracts, manifest parity, scanner, build, and browser smoke |
| Compatibility and locale infrastructure | Intentional / maintained | `web/src/i18n/legacy.js` remains the legacy lookup table for unmigrated surfaces; `web/src/i18n/messages/*.js`, `web/src/i18n/index.js`, and `docs/i18n/locale-key-manifest.json` are the stable-key boundary. | Dictionary/manifest parity, source scanner, and browser language smoke |
| Host integration | Partially covered | `CanvasCommandBar` in `web/src/App.jsx` is migrated. Host-provided chat/session data and command result text remain dynamic data. | Browser smoke covers standalone fallback; embedded-host journey remains |

The next migration batch should audit baseline-protected first-party literals in
`DocWallView.jsx`, `NodeDetailModal.jsx`, and embedded-host/recovery integration
journeys, then add browser coverage for schedule and variable-panel states.
