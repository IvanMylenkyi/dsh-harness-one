// 运行历史抽屉：最近运行 + 进度（3/4）+ 点开看节点状态与输出 + 重放 / 断点续跑。
import { useEffect, useState } from 'react';
import { apiUrl } from './api.js';
import { Modal } from './ui.jsx';
import { useI18n } from './i18n/index.js';

const STATUS_KEY = { running: 'status.running', success: 'status.success', error: 'status.error', canceled: 'status.canceled', interrupted: 'status.interrupted' };

function progressText(r) {
  const p = r.progress;
  if (!p || !p.total) return '';
  return `${p.done}/${p.total}`;
}

export function RunHistory({ onClose, onSelect, onResume, workflowId }) {
  const { formatDateTime, formatDuration, t } = useI18n();
  const [runs, setRuns] = useState([]);
  const [resuming, setResuming] = useState('');

  // 已保存工作流的画布只看该工作流的运行（后端按 workflowId 过滤）；
  // 草稿画布没有 workflowId，维持工作区全量。
  const load = () => {
    const query = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : '';
    fetch(apiUrl(`/runs${query}`)).then((r) => r.json()).then((d) => setRuns(d.runs || [])).catch(() => {});
  };
  useEffect(load, [workflowId]);

  const resumeRun = async (runId) => {
    if (resuming) return;
    setResuming(runId);
    try {
      const res = await fetch(apiUrl('/runs/resume'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('run.resumeFailed'));
      onResume?.(data.runId, data.resumedNodes, data.rerunNodes);
      onClose();
    } catch (e) {
      alert(`${t('run.resumeUnable')}: ${e.message}`);
      load();
    } finally {
      setResuming('');
    }
  };

  return (
    <Modal title={t('nav.history')} onClose={onClose}>
      <div className="rh-list">
        {runs.length === 0 && <p className="panel-empty">{t('run.empty')}</p>}
        {runs.map((r) => (
          <div key={r.runId} className={`rh-row-wrap ${r.live ? 'rh-live' : ''}`}>
            <button className={`rh-row st-${r.status}`} onClick={() => { onSelect?.(r.runId); onClose(); }}>
              <span className={`rh-status st-${r.status}`}>{t(STATUS_KEY[r.status] || 'run.statusUnknown', { status: r.status })}</span>
              <span className="rh-name">{r.workflowName || t('run.draft')}</span>
              <span className="rh-meta">
                {formatDateTime(r.startedAt)}
                {r.durationMs != null && ` · ${formatDuration(r.durationMs)}`}
                {r.canceled && ` · ${t('status.canceled')}`}
                {r.replayOf && ` · ${t('run.replay')}`}
                {r.resumedFrom && ` · ${t('run.resumed')}`}
              </span>
              {progressText(r) && <span className="rh-progress">{progressText(r)}</span>}
              {r.live && <span className="badge badge-plan">LIVE</span>}
            </button>
            {r.resumable && (
              <button className="btn btn-sm rh-resume" disabled={resuming === r.runId}
                title={t('run.resumeTitle')}
                onClick={() => resumeRun(r.runId)}>
                {resuming === r.runId ? t('run.starting') : `${t('action.resume')} ${progressText(r)}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
