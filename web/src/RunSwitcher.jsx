// 运行切换器：成果面板顶部的运行胶囊条。LIVE 优先、时间倒序，点击切换当前查看的运行。
import { SOURCE_ICON, SOURCE_KEY, capsuleTime, switcherCapsules } from './run-switcher.js';
import { useI18n } from './i18n/index.js';

const STATUS_DOT = { running: 'rs-dot-run', success: 'rs-dot-ok', error: 'rs-dot-err', canceled: 'rs-dot-cancel', interrupted: 'rs-dot-err' };
const STATUS_KEY = { running: 'status.running', success: 'status.success', error: 'status.error', canceled: 'status.canceled', interrupted: 'status.interrupted' };

export function RunSwitcher({ runs, inspectedRunId, onSelect, onOpenHistory }) {
  const { formatDateTime, t } = useI18n();
  const { shown, overflow } = switcherCapsules(runs);
  if (!shown.length) return null;
  return (
    <div className="run-switcher" role="tablist" aria-label={t('run.switcher')}>
      {shown.map((r) => {
        const active = r.runId === inspectedRunId;
        return (
          <button
            key={r.runId}
            className={`run-pill ${active ? 'run-pill-on' : ''}`}
            role="tab"
            aria-selected={active}
            title={`${t(SOURCE_KEY[r.source] || 'run.source.unknown', { source: r.source })} · ${r.live ? t('status.running') : t(STATUS_KEY[r.status] || 'run.statusUnknown', { status: r.status })}${r.startedAt ? ` · ${formatDateTime(r.startedAt)}` : ''}`}
            onClick={() => onSelect?.(r.runId)}
          >
            <span className={`rs-dot ${STATUS_DOT[r.status] || 'rs-dot-idle'}${r.live ? ' rs-dot-live' : ''}`} aria-hidden="true" />
            <span className="rs-icon" aria-hidden="true">{SOURCE_ICON[r.source] || '▶'}</span>
            <span className="rs-time">{capsuleTime(r.startedAt)}</span>
            {r.progress && <span className="rs-progress">{r.progress}</span>}
          </button>
        );
      })}
      {overflow > 0 && (
        <button className="run-pill run-pill-more" title={t('run.moreHistory')} onClick={onOpenHistory}>+{overflow}</button>
      )}
    </div>
  );
}
