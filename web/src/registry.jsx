// 节点类型注册表（前端单一来源）：加一种新节点 = 在这里加一个对象。
// 图标统一内联 SVG（stroke 1.8，24 viewBox），禁 emoji（跨平台渲染不一致、无法令牌化）。

const I = (paths, extra = '') => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;

const ICONS = {
  input: I('<path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>'),
  agent: I('<rect x="5" y="7" width="14" height="11" rx="3"/><circle cx="9.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M12 7V4m-4 14v1.5a1.5 1.5 0 003 0V18m2 0v1.5a1.5 1.5 0 003 0V18"/>'),
  condition: I('<path d="M6 4v6a2 2 0 002 2h8"/><path d="M18 20v-6a2 2 0 00-2-2H8"/><circle cx="6" cy="4" r="1.6" fill="currentColor" stroke="none"/><circle cx="18" cy="20" r="1.6" fill="currentColor" stroke="none"/>'),
  http: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/>'),
  script: I('<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>'),
  output: I('<path d="M12 15V3m0 0l-4 4m4-4l4 4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>'),
  notify: I('<path d="M10.3 21a2 2 0 003.4 0"/><path d="M4 17h16c-1.5-1.6-2-3.2-2-7a6 6 0 00-12 0c0 3.8-.5 5.4-2 7z"/>'),
  note: I('<path d="M4 5h16M4 12h10M4 19h7"/>'),
  subworkflow: I('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5M16 13l2 2-2 2"/>'),
};

export const NODE_REGISTRY = [
  {
    type: 'input',
    icon: ICONS.input, labelKey: 'node.input', color: 'var(--type-input)',
    preset: (t = (value) => value) => ({ label: t('node.newInput'), text: '', attachments: [] }),
    summary: (d, t = (value) => value) => d.text || t('node.inputNotConfigured'),
  },
  {
    type: 'agent',
    icon: ICONS.agent, labelKey: 'node.agent', color: 'var(--type-agent)',
    preset: (t = (value) => value) => ({ label: t('node.newAgent'), prompt: '', tools: [] }),
    summary: (d, t = (value) => value) => `${t('node.prompt')}：${d.prompt || t('node.defaultAssistant')}`,
    badges: (d) => [
      d.model && { text: shortModel(d.model), cls: 'badge-model', title: `模型：${d.model}` },
      d.maxRounds && { text: `↻${d.maxRounds}` },
      (d.tools || []).length > 0 && { textKey: 'node.tools' },
      (d.skills || []).length > 0 && { textKey: 'node.skillsCount', variables: { count: d.skills.length } },
    ].filter(Boolean),
  },
  {
    type: 'condition',
    icon: ICONS.condition, labelKey: 'node.condition', color: 'var(--type-condition)',
    preset: (t = (value) => value) => ({ label: t('node.conditionCheck'), include: '', exclude: '' }),
    summary: (d, t = (value) => value) => `${t('node.contains')}"${(d.include || t('node.any')).split(/[,，]/)[0]}"→ ${t('node.yes')}`,
    badges: () => [{ textKey: 'node.branching', cls: 'badge-cond' }],
  },
  {
    type: 'http',
    icon: ICONS.http, labelKey: 'node.http', color: 'var(--type-http)',
    preset: (t = (value) => value) => ({ label: t('node.http'), url: '', method: 'GET', headers: '', body: '' }),
    summary: (d, t = (value) => value) => `${(d.method || 'GET')} ${(d.url || `(${t('未配置 URL')})`).slice(0, 30)}`,
    badges: (d) => d.url ? [{ textKey: 'node.api' }] : [],
  },
  {
    type: 'script',
    icon: ICONS.script, labelKey: 'node.script', color: 'var(--type-script)',
    preset: (t = (value) => value) => ({ label: t('node.script'), inputs: [], code: 'function main(input, workspace) {\n  return input;\n}' }),
    summary: (d, t = (value) => value) => `main(input, workspace) · ${(d.inputs || []).length} ${t('node.parameters')}`,
    badges: (d) => [
      (d.inputs || []).length > 0 && { textKey: 'node.parametersCount', variables: { count: d.inputs.length } },
      d.outputSchema && { text: 'Schema' },
    ].filter(Boolean),
  },
  {
    type: 'output',
    icon: ICONS.output, labelKey: 'node.output', color: 'var(--type-output)',
    preset: (t = (value) => value) => ({ label: t('node.newOutput') }),
    summary: (d, t = (value) => value) => t('node.upstreamSummary'),
  },
  {
    type: 'notify',
    icon: ICONS.notify, labelKey: 'node.notify', color: 'var(--accent)',
    preset: (t = (value) => value) => ({
      label: t('node.notify'), channel: 'feishu', mode: 'terminal',
      channelConfig: { targetType: 'chat_id', targetId: '' },
    }),
    summary: (d, t = (value) => value) => `${d.channel === 'feishu' ? t('node.feishu') : (d.channel || t('未选渠道'))} · ${d.channelConfig?.targetType === 'open_id' ? t('node.directMessage') : t('node.groupChat')} · ${d.mode === 'each_node' ? t('node.eachNode') : t('node.onCompletion')}`,
    badges: (d) => [
      { textKey: d.channel === 'feishu' ? 'node.feishuCard' : 'node.channel' },
      { textKey: d.channelConfig?.targetType === 'open_id' ? 'node.directMessage' : 'node.groupChat' },
      { textKey: d.mode === 'each_node' ? 'node.eachNode' : 'node.runComplete' },
    ],
  },
  {
    type: 'note',
    icon: ICONS.note, labelKey: 'node.note', color: 'var(--type-note)',
    preset: (t = (value) => value) => ({ label: t('node.description'), text: '' }),
    summary: (d, t = (value) => value) => d.text || t('node.emptyDescription'),
    badges: () => [{ textKey: 'node.notExecuted', cls: 'badge-note' }],
  },
  {
    type: 'subworkflow',
    icon: ICONS.subworkflow, labelKey: 'node.subworkflow', color: 'var(--type-subworkflow, var(--accent))',
    preset: (t = (value) => value) => ({ label: t('node.subworkflow'), workflowId: '', inputMap: { triggerInput: '$upstream', runInputs: {} } }),
    summary: (d, t = (value) => value) => d.workflowName || d.workflowId || t('node.noWorkflow'),
    badges: (d) => [
      { textKey: 'node.syncCall' },
      d.workflowId && { text: d.workflowId.slice(0, 12), cls: 'badge-model' },
    ].filter(Boolean),
  },
];

export const kindOf = (type) => NODE_REGISTRY.find((k) => k.type === type) || {
  type, icon: '', label: type, color: 'var(--type-unknown)', preset: () => ({}), summary: () => type,
};

function shortModel(m) {
  const parts = String(m).split(':');
  return parts[parts.length - 1].replace(/^glm-/, 'GLM ');
}
