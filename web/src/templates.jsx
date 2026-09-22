// 新建工作流模板库：空画布引导 + 快速起步。
import { useState } from 'react';
import { Modal } from './ui.jsx';
import { useI18n } from './i18n/index.js';

export const TEMPLATES = [
  {
    id: 'blank',
    nameKey: 'template.seed.blankName',
    descriptionKey: 'template.seed.blankDescription',
    graph: { nodes: [], edges: [] },
  },
  {
    id: 'gongdan',
    nameKey: 'template.seed.gongdanName',
    descriptionKey: 'template.seed.gongdanDescription',
    graph: {
      nodes: [
        { id: 'in', type: 'input', position: { x: 60, y: 200 }, data: { label: 'template.content.ticketInputLabel', text: 'template.content.ticketInputText', attachments: [] } },
        { id: 'agent', type: 'agent', position: { x: 380, y: 190 }, data: { label: 'template.content.ticketOrganizeLabel', prompt: 'template.content.ticketOrganizePrompt', tools: [] } },
        { id: 'out', type: 'output', position: { x: 700, y: 210 }, data: { label: 'template.content.ticketOutputLabel' } },
      ],
      edges: [
        { id: 'e1', source: 'in', target: 'agent' },
        { id: 'e2', source: 'agent', target: 'out' },
      ],
    },
  },
  {
    id: 'urgency-route',
    nameKey: 'template.seed.urgencyName',
    descriptionKey: 'template.seed.urgencyDescription',
    graph: {
      nodes: [
        { id: 'in', type: 'input', position: { x: 40, y: 220 }, data: { label: 'template.content.urgencyInputLabel', text: 'template.content.urgencyInputText', attachments: [] } },
        { id: 'cond', type: 'condition', position: { x: 320, y: 220 }, data: { label: 'template.content.urgencyConditionLabel', include: 'template.content.urgencyKeywords', exclude: '' } },
        { id: 'urgent', type: 'agent', position: { x: 600, y: 100 }, data: { label: 'template.content.urgentPathLabel', prompt: 'template.content.urgentPathPrompt', tools: [] } },
        { id: 'normal', type: 'agent', position: { x: 600, y: 330 }, data: { label: 'template.content.routinePathLabel', prompt: 'template.content.routinePathPrompt', tools: [] } },
        { id: 'out', type: 'output', position: { x: 900, y: 215 }, data: { label: 'template.content.urgencyOutputLabel' } },
      ],
      edges: [
        { id: 'e1', source: 'in', target: 'cond' },
        { id: 'e2', source: 'cond', target: 'urgent', branch: 'true' },
        { id: 'e3', source: 'cond', target: 'normal', branch: 'false' },
        { id: 'e4', source: 'urgent', target: 'out' },
        { id: 'e5', source: 'normal', target: 'out' },
      ],
    },
  },
  {
    id: 'review-summary',
    nameKey: 'template.seed.reviewName',
    descriptionKey: 'template.seed.reviewDescription',
    graph: {
      nodes: [
        { id: 'in', type: 'input', position: { x: 60, y: 220 }, data: { label: 'template.content.reviewInputLabel', text: 'template.content.reviewInputText', attachments: [] } },
        { id: 'cost', type: 'agent', position: { x: 360, y: 100 }, data: { label: 'template.content.costPerspectiveLabel', prompt: 'template.content.costPerspectivePrompt', tools: [] } },
        { id: 'quality', type: 'agent', position: { x: 360, y: 340 }, data: { label: 'template.content.qualityPerspectiveLabel', prompt: 'template.content.qualityPerspectivePrompt', tools: [] } },
        { id: 'merge', type: 'agent', position: { x: 660, y: 220 }, data: { label: 'template.content.reviewSummaryLabel', prompt: 'template.content.reviewSummaryPrompt', tools: [] } },
        { id: 'out', type: 'output', position: { x: 950, y: 220 }, data: { label: 'template.content.reviewOutputLabel' } },
      ],
      edges: [
        { id: 'e1', source: 'in', target: 'cost' },
        { id: 'e2', source: 'in', target: 'quality' },
        { id: 'e3', source: 'cost', target: 'merge' },
        { id: 'e4', source: 'quality', target: 'merge' },
        { id: 'e5', source: 'merge', target: 'out' },
      ],
    },
  },
];

export function TemplateModal({ onClose, onApply }) {
  const { t } = useI18n();
  const [picked, setPicked] = useState('gongdan');
  const templates = TEMPLATES.map((template) => ({
    ...template,
    graph: {
      nodes: template.graph.nodes.map((node) => ({
        ...node,
        data: Object.fromEntries(Object.entries(node.data).map(([key, value]) => [
          key,
          typeof value === 'string' && value.startsWith('template.content.') ? t(value) : value,
        ])),
      })),
      edges: template.graph.edges,
    },
  }));
  const tpl = templates.find((template) => template.id === picked);
  return (
    <Modal
      title={t('template.seedTitle')}
      onClose={onClose}
      footer={(
        <>
          <button className="btn" onClick={onClose}>{t('action.cancel')}</button>
          <button className="btn btn-primary" onClick={() => onApply(tpl)}>{t('template.seedApply')}</button>
        </>
      )}
    >
      <div className="tpl-grid">
        {templates.map((template) => (
          <button key={template.id} className={`tpl-card ${picked === template.id ? 'tpl-on' : ''}`} onClick={() => setPicked(template.id)}>
            <div className="tpl-name">{t(template.nameKey)}</div>
            <div className="tpl-desc">{t(template.descriptionKey)}</div>
          </button>
        ))}
      </div>
      {tpl.graph.nodes.length > 0 && (
        <p className="sec-hint">{t('template.seedMeta', {
          nodes: tpl.graph.nodes.length,
          agents: tpl.graph.nodes.filter((n) => n.type === 'agent').length,
          edges: tpl.graph.edges.length,
        })}</p>
      )}
    </Modal>
  );
}
