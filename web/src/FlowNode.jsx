// 节点视觉 v5：类型元数据/徽标/摘要全部来自 registry.jsx（新增节点类型零改动这里）。
// 自定义节点必须渲染 Handle 才能拖拽建线、锚定已有连线。

import { useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NODE_REGISTRY, kindOf } from './registry.jsx';
import { useI18n } from './i18n/index.js';

// 状态边框走 CSS 变量（跟随主题）：borderColor 由 CSS 类/内联 var() 决定，
// 这里只给结构（粗细/线型/透明度）与光晕强度。
const STATUS_STYLE = {
  idle: {},
  queued: { border: '2px solid var(--canceled)' },
  running: { border: '2px solid var(--edge-running)', boxShadow: '0 0 12px rgba(245,158,11,.6)' },
  waiting: { border: '2px dashed var(--pink)', boxShadow: '0 0 12px rgba(219,39,119,.4)' },
  success: { border: '2px solid var(--edge-success)' },
  error: { border: '2px solid var(--edge-error)' },
  skipped: { border: '2px dashed var(--edge-skipped)', opacity: 0.6 },
  canceled: { border: '2px dotted var(--canceled)', opacity: 0.7 },
};

/** 运行中节点的实时计时：mm:ss，每秒自跳（节点结束即停，开销一个 interval） */
function useElapsedBadge(startedAt, active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  if (!active || !startedAt) return '';
  const sec = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mm = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

const CHILD_TYPES = NODE_REGISTRY.map((k) => ({ type: k.type, icon: k.icon, labelKey: k.labelKey }));

export function FlowNode({ data, selected, id, onAddChild }) {
  const { t } = useI18n();
  const meta = kindOf(data.nodeType);
  const status = data.runStatus || 'idle';
  const turns = status === 'running' ? data.liveTurns : data.runTurns;
  const elapsed = useElapsedBadge(data.runStartedAt, status === 'running');
  const statusText = {
    queued: t('status.queued'), running: <span className="flow-node-running"><span className="spinner" />{t('status.executing')}</span>,
    waiting: `⏸ ${t('status.waiting')}`,
    error: `✗ ${t('status.error')}`, skipped: t('status.skipped'), canceled: t('status.canceled'),
  };
  const statusDetail = status === 'success'
    ? `✓ ${t('status.charsCount', { count: data.runChars ?? 0 })}${turns != null ? ` · ${t('status.roundsCount', { count: turns })}` : ''}`
    : status === 'running'
      ? (turns != null ? ` ${t('status.roundsCount', { count: turns })}` : '')
      : `${statusText[status] || ''}${turns != null ? ` · ${t('status.roundsCount', { count: turns })}` : ''}`;
  const badges = [
    ...extraBadges(data),
    ...((meta.badges || (() => []))(data) || []),
  ].filter(Boolean);

  return (
    <div className={`flow-node ${status === 'running' ? 'flow-node-is-running' : ''}`} style={{ borderColor: meta.color, ...STATUS_STYLE[status] }}>
      <Handle type="target" position={Position.Left} className="flow-handle flow-handle-target" />
      <div className="flow-node-head" style={{ background: meta.color }}>
        <span className="flow-node-title"><span dangerouslySetInnerHTML={{ __html: meta.icon }} />{data.label || t(meta.labelKey || meta.label)}</span>
        <span className="flow-node-badge">
          {status === 'running' && elapsed && <span className="flow-node-elapsed" title={t('node.elapsed')}>{elapsed}</span>}
          {status === 'running' && statusText.running}
          {statusDetail}
        </span>
      </div>
      <div className="flow-node-body">
        <p className="flow-node-hint">{clip(meta.summary(data, t), 60)}</p>
        {badges.length > 0 && (
          <p className="flow-node-badges">
          {badges.map((b, i) => <span key={i} className={`badge ${b.cls || ''}`} title={b.title}>{t(b.textKey || b.text, b.variables)}</span>)}
          </p>
        )}
        {status === 'running' && data.livePreview && (
          <p className="flow-node-live">{clip(data.livePreview, 64)}</p>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="flow-handle flow-handle-source" />
      {/* hover 快捷加下游节点：点 + 展开类型菜单，选中即在右侧生成并自动连线 */}
      {onAddChild && (
        <div className="flow-node-addwrap">
          <button
            type="button"
            className="flow-node-addbtn"
            aria-label={t('node.addNext')}
            title={t('node.addNextConnected')}
            onClick={(e) => {
              e.stopPropagation();
              const wrap = e.currentTarget.closest('.flow-node-addwrap');
              // 关掉其他节点已开的菜单，再切换当前（并提升节点层级防遮挡）
              document.querySelectorAll('.flow-node-addwrap.add-open').forEach((w) => {
                if (w !== wrap) w.classList.remove('add-open');
              });
              wrap?.classList.toggle('add-open');
            }}
          >＋</button>
          <div className="flow-node-addmenu" role="menu">
            {CHILD_TYPES.map((child) => (
              <button
                key={child.type}
                type="button"
                role="menuitem"
                className="flow-node-additem"
                onClick={(e) => {
                  e.stopPropagation();
                  e.currentTarget.closest('.flow-node-addwrap')?.classList.remove('add-open');
                  onAddChild(id, child.type);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              ><span dangerouslySetInnerHTML={{ __html: child.icon }} />{t(child.labelKey || child.label)}</button>
            ))}
          </div>
        </div>
      )}
      {selected && <div className="flow-node-selected-tag">{t('node.selected')}</div>}
    </div>
  );
}

// registry 之外的展示型徽标（附件/飞书链接等类型内细节）
function extraBadges(data) {
  const out = [];
  if (data.nodeType === 'input') {
    if (data.attachments?.length > 0) out.push({ textKey: 'node.attachmentsCount', variables: { count: data.attachments.length } });
    if (/feishu\.cn\//.test(data.text || '')) out.push({ textKey: 'node.feishu' });
  }
  return out;
}

function clip(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}
