# Workflow One UI string inventory

Audit basis: fork branch `feat/i18n-en` after syncing upstream `v0.11.0`
(`9483c87809a0d3efac58da4e35aad7a015ca8371`). This inventory distinguishes
first-party product UI from user-authored/workflow data, model output, server
diagnostics, protocol syntax, and developer tooling.

| Surface | Status | Concrete files and remaining gaps | Verification |
| --- | --- | --- | --- |
| Application shell and canvas chrome | Migrated | `web/src/App.jsx`, `web/src/ui.jsx`; stable keys cover navigation, toolbar, runtime badge, command bar, modal/toast/confirmation, lint/error/loading/empty states, placeholders, tooltip and ARIA copy. v0.11 removed the seeded example graph and reset route; an empty canvas now opens the template library. | `i18n-browser.spec.mjs`: English ↔ zh-CN, template modal/application, toast, empty status and lint error |
| Node editors and validation | Migrated | `web/src/NodePanel.jsx`, `AgentSchemaEditor.jsx`, `RichDocEditor.jsx`, `ScriptCodeEditor.jsx`, `global-variables.js`, `script-parameters.js`; first-party labels and local validation errors use stable keys/error descriptors. | Editor/settings browser smoke and web unit tests |
| Workflow library and shipped templates | Migrated | `web/src/WorkflowList.jsx`, `TemplateEditor.jsx`, `templates.jsx`; shipped starter graph labels, examples, prompts and condition keywords are locale-keyed and materialized in the active locale when shown/applied. Existing saved workflows and user-edited graph data are untouched. | `editors-browser.spec.mjs` asserts English content has no Han, Chinese template content, and switch back to English |
| Variable explorer / API schema groups | Migrated for known first-party group metadata | `web/src/variables.js` recognizes only the stable IDs of the five built-in `/variables/describe` groups and assigns locale keys; `web/src/TemplateEditor.jsx` renders localized group labels and the `group` type badge. Arbitrary user group labels, workflow/node names, schema labels and values remain unchanged. This API-generated surface was missed by the earlier source-only UI scan. | `variables.test.mjs` checks known IDs vs user-owned labels; `editors-browser.spec.mjs` checks English → zh-CN → English and verifies user label preservation |
| Runs, results and recovery | Migrated for local UI | `RunHistory.jsx`, `RunSwitcher.jsx`, `TestRunModal.jsx`, `ResultPanel.jsx`, `result-adapter.js`, `json-response.js`, `NodeDetailModal.jsx`; local status/error fallbacks use stable keys. Server error payloads, trace text, node labels and model output remain unmodified data. | ResultPanel, recovery and boundary browser tests; adapter tests |
| Document wall and feedback | Migrated for UI chrome | `DocWallView.jsx`, `doc-wall-data.js`, `ArtifactPreview.jsx`, `MarkdownDocument.jsx`, `docwall-feedback.jsx`; UI/accessibility/link-type copy translated. Document bodies, filenames, comments, revision summaries and server errors stay as data. | Recovery, feedback and boundary browser tests |
| Document preview plugin | Migrated for first-party preview UI | `dsh-plugins/dsh-ccpg-document-preview/src/react.jsx`, `src/renderers/{pdf,pptx,sheet,docx,univer}.jsx`, `src/i18n.js`; renderer controls and local loading/errors use stable plugin keys. | `document-preview-browser.spec.mjs`, plugin unit suite and build |
| Settings and scheduled work | Migrated | `FeishuCredModal.jsx`, `VariableCenter.jsx`, `ScheduleCenter.jsx`, `variables.js`, `schedule-center.js`; local labels, validation and cron summaries use stable keys. Credential values and API-provided errors are not rewritten. | Settings browser smoke and unit tests |
| Canvas host plugin | Migrated for its shipped UI | `dsh-plugins/dsh-ccpg-canvasui/src/client.js` and generated `lib/client.js`; workflow-card chrome, prompts/suggestions shipped by the product, settings placeholder, references and ARIA copy are localized. User workflow names, user prompts, labels, server responses and run output remain data. | Canvas host browser test and `test/client.test.mjs` |
| Lark authorization host UI | Migrated | `dsh-plugins/dsh-ccpg-larkauth/lib/client.js`; install, sign-in, renewal, QR, tooltip, errors, buttons and ARIA copy use stable keys. Identity/app metadata, server errors and CLI payloads remain data. | `larkauth-browser.spec.mjs` and web suite |
| Compatibility and locale infrastructure | Deliberate compatibility boundary | `web/src/i18n/legacy.js` and exported `tx()`/`translateText()` remain for external callers only; first-party components use stable keys and scanner rejects legacy calls. `/变量` remains a supported command. `templates.jsx` uses translation keys for bundled sample content, not persisted user data. | Locale parity, key/placeholder tests, scanner, browser tests |
| CLI installer | Chinese first-party CLI copy remains | `dsh-plugins/dsh-ccpg-one/bin/install.js` has Chinese usage, errors and completion output. It is developer/operator CLI, not the web/plugin UI migration surface; localize in a separate CLI i18n batch if English CLI support is required. | Identified by source audit; not claimed migrated |
| Legacy standalone server / engine diagnostics | Chinese remains outside current plugin UI boundary | `server/agent-runtime.js`, `server/feishu.js`, `server/llm*.js`, `server/orchestrator.js`, `server/plan-mode.js` contain legacy standalone server diagnostics, prompt templates and model output scaffolding. Do not rewrite user/model/prompt data as UI copy. `dsh-ccpg-orchestrator/lib/index.js` is active backend code; stable machine error codes are localized at frontend boundaries where available, while raw engine/API details remain diagnostic data. | Source audit; plugin integration tests require a compatible optional DSH peer set |
| Strict production bundle scan | Known unresolved | `scripts/check-i18n.mjs --strict` scans all generated first-party JS chunks and currently reports `web/dist/assets/index-BF5MY9Sr-CtILwP-O.js` and `index-D3RoGhku.js`. The chunks contain locale/preview/runtime content; they are not excluded. Split/attribute these bundles before calling strict bundle scan green. | Strict scan currently FAILS on these two chunks; source scanner and parity pass |

The source audit reports 164 remaining non-comment CJK fragments and zero
unstable `t()`/`tx()` calls. The fragments are classified in the rows above:
protocol/parser literals (`lint: 通过`, `/工作流` reference syntax), host log,
CLI installer text, and legacy server prompts/diagnostics/data. They are not a
claim that every first-party executable or operator surface is English.

The translation work for the shipped web and embedded plugin UI is complete
within that scope. Remaining work is explicit: English CLI installer UX,
legacy standalone server/operator diagnostics if those are brought into scope,
compatible DSH peer dependencies for all root integration tests, and production
bundle attribution/splitting so strict bundle scanning can pass. User content
must remain unchanged throughout.
