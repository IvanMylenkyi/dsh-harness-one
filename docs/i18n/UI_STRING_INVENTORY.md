# Workflow One UI string inventory

Baseline inventory for the `v0.10.0` upstream commit
`a4f7fe95b0d419d3a87f0105ff018d4e56062ee`. The inventory is grouped by
first-party surface so additions can be reviewed without coupling message keys
to source-file names.

| Surface | Components/files | Message boundary | Verification |
| --- | --- | --- | --- |
| Canvas shell | `App.jsx`, `ToolbarMenus.jsx`, `FlowNode.jsx`, `EdgeLine.jsx` | nav, toolbar, graph status, menus, ARIA labels | English/Chinese shell smoke journey |
| Node editors | `NodePanel.jsx`, `AgentSchemaEditor.jsx`, `ScriptCodeEditor.jsx` | node type labels, fields, validation, placeholders | create/edit one node of every type |
| Workflow library | `WorkflowList.jsx`, `TemplateEditor.jsx`, `templates.jsx` | CRUD, search, templates, import/export | create, rename, duplicate, import, export |
| Runs and recovery | `RunWorkflowModal.jsx`, `RunHistory.jsx`, `RunSwitcher.jsx`, `TestRunModal.jsx` | run lifecycle, history, retry, resume | success/failure/cancel/resume journey |
| Results | `ResultPanel.jsx`, `ResultViewer.jsx`, `DocWallView.jsx`, `ArtifactPreview.jsx` | process/result/issues, preview and download chrome | artifact matrix and empty states |
| Settings | `FeishuCredModal.jsx`, `VariableCenter.jsx`, `ScheduleCenter.jsx` | credentials, variables, schedules, cron | settings and validation journey |
| Host integration | `dsh-ccpg-canvasui`, `dsh-ccpg-web`, `CanvasCommandBar` | embedded entry point and chat cards | standalone `/wf1/` plus embedded canvas |
| Cross-cutting | `ui.jsx`, API error adapters, toasts | modals, toasts, accessible names, errors | DOM crawl and missing-key diagnostics |

The reusable layer is in `web/src/i18n/`. Existing legacy literals are routed
through a compatibility bridge while components migrate to stable keys. The
bridge skips user-authored content, model output, code, and document bodies.
New source literals are blocked by `scripts/check-i18n.mjs`.
