# Workflow One UI string inventory

Audit baseline: `upstream/main` at the current roadmap baseline. This inventory
tracks first-party UI copy only. Comments, compatibility dictionaries,
user-authored workflow names/prompts/node labels, filenames, document bodies,
model output, server-provided error text, code, and the supported `/变量`
command are excluded from migration scope.

| Surface | Current status | Concrete files and remaining gaps | Verification |
| --- | --- | --- | --- |
| Application shell and canvas chrome | Migrated in this batch | `web/src/App.jsx`, `web/src/ui.jsx`; stable keys now cover navigation, toolbar, runtime badge, canvas progress, command bar, edge inspector, resume modal, lint bar, error/toast wrappers, placeholders, and ARIA labels. | `i18n-browser.spec.mjs`: both language directions, modal, toast, empty run status, lint error |
| Node editors | Partial | `web/src/NodePanel.jsx` is migrated; remaining first-party UI literals are in `web/src/AgentSchemaEditor.jsx` and `web/src/RichDocEditor.jsx`. `web/src/ScriptCodeEditor.jsx` has no remaining CJK UI literal in the audit. | Existing unit/UI tests; browser coverage still needed for the remaining editors |
| Workflow library and templates | Partial | `web/src/WorkflowList.jsx` and `web/src/TemplateEditor.jsx` are migrated. `web/src/templates.jsx` still contains template seed names/descriptions and template-modal chrome; seed graph labels/prompts are intentional template/user content, while the modal chrome remains to migrate. | Workflow-list/template tests; browser migration coverage pending |
| Runs and recovery | Partial | `web/src/RunHistory.jsx`, `web/src/RunSwitcher.jsx`, and `web/src/TestRunModal.jsx` are migrated. App-level recovery and run messages are migrated; `web/src/result-adapter.js` still returns first-party fallback/status/duration strings that need stable-key handling. | ResultPanel browser smoke covers completed duration; recovery journey pending |
| Results and document wall | Migrated | `web/src/ResultPanel.jsx`, `web/src/ResultViewer.jsx`, `web/src/DocWallView.jsx`, `web/src/ArtifactPreview.jsx`, and `web/src/MarkdownDocument.jsx` use stable keys for UI chrome. Dynamic documents, filenames, links, and model output remain data. | ResultPanel and DocWall tests; parity/scanner/build pass |
| Settings and scheduled work | Partial | `web/src/FeishuCredModal.jsx`, `web/src/VariableCenter.jsx`, and `web/src/ScheduleCenter.jsx` are migrated. Remaining first-party formatting/error literals are in `web/src/global-variables.js`, `web/src/variables.js`, and `web/src/schedule-center.js`. | Settings/schedule unit tests; browser journey pending |
| Feedback and rich document editing | Partial | `web/src/docwall-feedback.jsx` and `web/src/RichDocEditor.jsx` still contain first-party modal, empty, validation, accessibility, and editor-toolbar copy. | No dedicated browser journey yet |
| Cross-cutting adapters and validation | Partial | `web/src/json-response.js`, `web/src/workflow-serialization.js`, `web/src/patch-confirm.js`, and `web/src/result-adapter.js` still construct first-party fallback/error summaries. These require a stable error-code/message boundary without translating server data. | Unit coverage exists; key-based adapter contract still needed |
| Compatibility and locale infrastructure | Intentional / maintained | `web/src/i18n/legacy.js` remains the legacy lookup table for unmigrated surfaces; `web/src/i18n/messages/*.js`, `web/src/i18n/index.js`, and `docs/i18n/locale-key-manifest.json` are the stable-key boundary. | Dictionary/manifest parity, source scanner, and browser language smoke |
| Host integration | Partially covered | `CanvasCommandBar` in `web/src/App.jsx` is migrated. Host-provided chat/session data and command result text remain dynamic data. | Browser smoke covers standalone fallback; embedded-host journey remains |

The next migration batch should close `AgentSchemaEditor.jsx`,
`RichDocEditor.jsx`, and the template-modal chrome, then move through the
adapter/validation boundary (`result-adapter.js`, `variables.js`,
`global-variables.js`, `schedule-center.js`).
