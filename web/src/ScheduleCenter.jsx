// 定时任务面板：列表（下次触发/触发统计/启停/立即运行/删除）+ 创建/编辑表单
// （cron 预设 + 实时预览下 3 次触发 + 重叠策略）。风格对齐 VariableCenter 的 Modal。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from './api.js';
import { Modal } from './ui.jsx';
import { CRON_PRESETS, describeCron, formatNextInZone, hostTimezone, presetOfCron, supportedTimezones, timezoneOffsetLabel } from './schedule-center.js';
import { useI18n } from './i18n/index.js';

const PRESET_KEY = {
  'daily-9': 'schedule.preset.daily9',
  hourly: 'schedule.preset.hourly',
  'weekly-mon-9': 'schedule.preset.weeklyMon9',
  'weekdays-9': 'schedule.preset.weekdays9',
};
const DAY_KEY = { '\u5468\u65e5': 'schedule.day.sun', '\u5468\u4e00': 'schedule.day.mon', '\u5468\u4e8c': 'schedule.day.tue', '\u5468\u4e09': 'schedule.day.wed', '\u5468\u56db': 'schedule.day.thu', '\u5468\u4e94': 'schedule.day.fri', '\u5468\u516d': 'schedule.day.sat' };

function localizeDays(value, t) {
  return value.split('、').map((day) => t(DAY_KEY[day] || 'schedule.unknownDay', { day })).join(t('schedule.dayJoiner'));
}

function localizeCronDescription(cron, t) {
  const raw = describeCron(cron);
  if (!raw) return '';
  let match = raw.match(/^\u6bcf\u5929 (\d{2}:\d{2})$/);
  if (match) return t('schedule.everyDayAt', { time: match[1] });
  match = raw.match(/^\u6bcf\u5c0f\u65f6\u7b2c (\d+) \u5206$/);
  if (match) return t('schedule.hourlyAtMinute', { minute: match[1] });
  if (raw === '\u6bcf\u5c0f\u65f6\u7b2c 0 \u5206\u8d77\u6bcf\u5206' || raw === '\u6bcf\u5206\u949f') return t('schedule.everyMinute');
  match = raw.match(/^\u6bcf\u5c0f\u65f6\u6bcf (\d+) \u5206\u949f$/);
  if (match) return t('schedule.everyMinutes', { count: match[1] });
  match = raw.match(/^\u5de5\u4f5c\u65e5 (\d{2}:\d{2})$/);
  if (match) return t('schedule.weekdaysAt', { time: match[1] });
  if (raw === '\u6bcf\u4e2a\u5de5\u4f5c\u65e5') return t('schedule.everyWeekday');
  match = raw.match(/^\u6bcf\u6708 (\d+) \u65e5(?: (\d{2}:\d{2}))?$/);
  if (match) return match[2] ? t('schedule.monthlyAt', { day: match[1], time: match[2] }) : t('schedule.monthlyOn', { day: match[1] });
  match = raw.match(/^(.+?) (\d{2}:\d{2})$/);
  if (match && match[1].split('\u3001').every((day) => DAY_KEY[day])) return t('schedule.weekdaysAtNamed', { days: localizeDays(match[1], t), time: match[2] });
  match = raw.match(/^\u6bcf(.+)$/);
  if (match && match[1].split('、').every((day) => DAY_KEY[day])) return t('schedule.everyWeekdays', { days: localizeDays(match[1], t) });
  return cron;
}

function validateRunInputsJson(text) {
  if (!text.trim()) return { ok: true, value: {} };
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: { i18nKey: 'schedule.runInputsObject', variables: {} } };
    }
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: { i18nKey: 'validation.invalidJson', variables: { message: e.message } } };
  }
}

function ScheduleForm({ workflows, initial, onSubmit, onCancel, submitting }) {
  const { t } = useI18n();
  const [workflowId, setWorkflowId] = useState(initial?.workflowId || (workflows[0]?.id || ''));
  const [cron, setCron] = useState(initial?.cron || CRON_PRESETS[0].cron);
  const [input, setInput] = useState(initial?.input || '');
  const [runInputsText, setRunInputsText] = useState(initial?.runInputs && Object.keys(initial.runInputs).length ? JSON.stringify(initial.runInputs, null, 2) : '');
  const [overlap, setOverlap] = useState(initial?.overlap || 'skip');
  // 停机错过触发点：ignore 同旧现状；catchUp 重启后补跑最近一次
  const [misfirePolicy, setMisfirePolicy] = useState(initial?.misfirePolicy || 'ignore');
  // timezone=null 跟随主机；时区候选按使用频率把常见区排前
  const [timezone, setTimezone] = useState(initial?.timezone || '');
  const [preview, setPreview] = useState({ state: 'idle' }); // idle | loading | ok | error
  const preset = presetOfCron(cron);
  const debounceRef = useRef(null);
  const timezoneOptions = useMemo(() => {
    const all = supportedTimezones();
    const common = ['Asia/Shanghai', 'UTC', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Tokyo', 'America/New_York', 'Europe/London'];
    const head = common.filter((tz) => all.includes(tz));
    return [...head, ...all.filter((tz) => !head.includes(tz))];
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!cron.trim()) { setPreview({ state: 'idle' }); return undefined; }
    setPreview({ state: 'loading' });
    debounceRef.current = setTimeout(() => {
      fetch(apiUrl('/schedule/preview'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cron, timezone: timezone || null }),
      })
        .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
        .then(({ ok, data }) => setPreview(ok ? { state: 'ok', times: data.times || [] } : { state: 'error', error: data.error || t('schedule.invalidCron') }))
        .catch(() => setPreview({ state: 'error', error: t('schedule.previewFailed') }));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [cron, timezone, t]);

  const runInputsCheck = validateRunInputsJson(runInputsText);
  const cronValid = preview.state === 'ok';
  const canSubmit = workflowId && cron.trim() && cronValid && runInputsCheck.ok && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      workflowId,
      cron: cron.trim(),
      input,
      runInputs: runInputsCheck.value,
      overlap,
      misfirePolicy,
      timezone: timezone || null,
    });
  };

  return (
    <div className="sch-form">
      <section className="panel-sec">
        <h4>{t('schedule.workflow')} <span className="sec-hint">{t('schedule.workflowHint')}</span></h4>
        <select className="sch-input" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} disabled={Boolean(initial?.workflowId)}>
          {workflows.map((wf) => <option key={wf.id} value={wf.id}>{wf.name}</option>)}
        </select>
      </section>
      <section className="panel-sec">
        <h4>{t('schedule.triggerTime')}</h4>
        <div className="sch-presets">
          {CRON_PRESETS.map((p) => (
            <button key={p.key} type="button" className={`chip ${preset?.key === p.key ? 'chip-on' : ''}`} onClick={() => setCron(p.cron)}>{t(PRESET_KEY[p.key] || 'schedule.custom')}</button>
          ))}
          <button type="button" className={`chip ${preset === null ? 'chip-on' : ''}`} onClick={() => setCron('')}>{t('schedule.custom')}</button>
        </div>
        <input
          className={`sch-input ${preview.state === 'error' ? 'sch-input-err' : ''}`}
          placeholder={t('schedule.cronPlaceholder')}
          value={cron}
          onChange={(e) => setCron(e.target.value)}
        />
        {preview.state === 'error' && <p className="sch-err">{preview.error}</p>}
        {preview.state === 'loading' && <p className="sec-hint">{t('schedule.validating')}</p>}
        {preview.state === 'ok' && (
          <p className="sch-preview">
            <strong>{localizeCronDescription(cron, t) || t('schedule.customCycle')}</strong>
            {t('schedule.nextRuns')}: {preview.times.map((time) => formatNextInZone(time, timezone)).join(t('schedule.timeJoiner'))}
          </p>
        )}
        <div className="sch-tz">
          <select
            className="sch-input sch-tz-select"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            title={t('schedule.timezoneTitle')}
          >
            <option value="">{t('schedule.followHost', { timezone: hostTimezone() })}</option>
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>{tz}（{timezoneOffsetLabel(tz)}）</option>
            ))}
          </select>
          {timezone && <p className="sec-hint">{t('schedule.timezoneSelectedHint', { timezone })}</p>}
        </div>
      </section>
      <section className="panel-sec">
        <h4>{t('schedule.triggerInput')} <span className="sec-hint">{t('schedule.triggerInputHint')}</span></h4>
        <textarea className="sch-input sch-textarea" rows={2} placeholder={t('schedule.triggerInputPlaceholder')} value={input} onChange={(e) => setInput(e.target.value)} />
      </section>
      <section className="panel-sec">
        <h4>{t('schedule.runParameters')} <span className="sec-hint">{t('schedule.runParametersHint')}</span></h4>
        <textarea
          className={`sch-input sch-textarea ${!runInputsCheck.ok ? 'sch-input-err' : ''}`}
          rows={2}
          placeholder='{"env": "prod"}'
          value={runInputsText}
          onChange={(e) => setRunInputsText(e.target.value)}
        />
        {!runInputsCheck.ok && <p className="sch-err">{runInputsCheck.error}</p>}
      </section>
      <section className="panel-sec">
        <h4>{t('schedule.overlap')} <span className="sec-hint">{t('schedule.overlapHint')}</span></h4>
        <div className="sch-overlap">
          <label className={`sch-radio ${overlap === 'skip' ? 'sch-radio-on' : ''}`}>
            <input type="radio" name="sch-overlap" checked={overlap === 'skip'} onChange={() => setOverlap('skip')} />
            <span><strong>{t('schedule.overlapSkip')}</strong><em>{t('schedule.overlapSkipHint')}</em></span>
          </label>
          <label className={`sch-radio ${overlap === 'parallel' ? 'sch-radio-on' : ''}`}>
            <input type="radio" name="sch-overlap" checked={overlap === 'parallel'} onChange={() => setOverlap('parallel')} />
            <span><strong>{t('schedule.overlapParallel')}</strong><em>{t('schedule.overlapParallelHint')}</em></span>
          </label>
        </div>
      </section>
      <section className="panel-sec">
        <h4>{t('schedule.misfire')} <span className="sec-hint">{t('schedule.misfireHint')}</span></h4>
        <div className="sch-overlap">
          <label className={`sch-radio ${misfirePolicy === 'ignore' ? 'sch-radio-on' : ''}`}>
            <input type="radio" name="sch-misfire" checked={misfirePolicy === 'ignore'} onChange={() => setMisfirePolicy('ignore')} />
            <span><strong>{t('schedule.misfireIgnore')}</strong><em>{t('schedule.misfireIgnoreHint')}</em></span>
          </label>
          <label className={`sch-radio ${misfirePolicy === 'catchUp' ? 'sch-radio-on' : ''}`}>
            <input type="radio" name="sch-misfire" checked={misfirePolicy === 'catchUp'} onChange={() => setMisfirePolicy('catchUp')} />
            <span><strong>{t('schedule.misfireCatchUp')}</strong><em>{t('schedule.misfireCatchUpHint')}</em></span>
          </label>
        </div>
      </section>
      <div className="sch-form-actions">
        <button className="btn" onClick={onCancel} disabled={submitting}>{t('action.cancel')}</button>
        <button className="btn btn-primary" onClick={submit} disabled={!canSubmit}>
          {submitting ? t('status.saving') : initial?.key ? t('schedule.saveChanges') : t('schedule.create')}
        </button>
      </div>
    </div>
  );
}

export function ScheduleCenter({ currentWorkflowId, onRan, onClose, toast }) {
  const { t } = useI18n();
  const [schedules, setSchedules] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [mode, setMode] = useState('list'); // list | create | edit
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const [schRes, wfRes] = await Promise.all([
        fetch(apiUrl('/schedule')).then((r) => r.json()),
        fetch(apiUrl('/workflows')).then((r) => r.json()),
      ]);
      setSchedules(schRes.schedules || []);
      setWorkflows(wfRes.workflows || []);
    } catch { /* 面板保持现状 */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (name, fn) => {
    if (busy) return;
    setBusy(name);
    try { await fn(); } finally { setBusy(''); }
  };

  const createOrUpdate = async (payload) => {
    await act('save', async () => {
      const isEdit = Boolean(editing?.key);
      const res = await fetch(apiUrl('/schedule'), {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { key: editing.key, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) { toast(`${t('schedule.saveFailed')}: ${data.error}`, 'error'); return; }
      toast(isEdit ? t('schedule.saved') : t('schedule.created'), 'success');
      setMode('list');
      setEditing(null);
      load();
    });
  };

  const runNow = (row) => act(`run:${row.key}`, async () => {
    const res = await fetch(apiUrl('/schedule/run'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: row.key }),
    });
    const data = await res.json();
    if (!res.ok) { toast(`${t('schedule.runFailed')}: ${data.error}`, 'error'); return; }
    toast(t('schedule.triggered'), 'success');
    onRan?.();
    load();
  });

  const toggleEnabled = (row) => act(`toggle:${row.key}`, async () => {
    const res = await fetch(apiUrl('/schedule'), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: row.key, enabled: !row.enabled }),
    });
    if (!res.ok) { toast(t('schedule.operationFailed'), 'error'); return; }
    toast(row.enabled ? t('schedule.disabledToast') : t('schedule.enabledToast'), 'info');
    load();
  });

  const doDelete = (key) => act(`del:${key}`, async () => {
    const res = await fetch(apiUrl(`/schedule?key=${encodeURIComponent(key)}`), { method: 'DELETE' });
    if (!res.ok) { toast(t('schedule.deleteFailed'), 'error'); return; }
    toast(t('schedule.deleted'), 'info');
    setConfirmDelete(null);
    load();
  });

  const startCreate = () => {
    // 预选当前打开的工作流（仅当它已保存）；草稿或未命中则用列表第一项兜底
    setEditing(currentWorkflowId && workflows.some((wf) => wf.id === currentWorkflowId)
      ? { workflowId: currentWorkflowId }
      : null);
    setMode('create');
  };

  return (
    <Modal title={mode === 'list' ? t('schedule.title') : mode === 'create' ? t('schedule.newTitle') : t('schedule.editTitle')} onClose={mode === 'list' ? onClose : () => { setMode('list'); setEditing(null); }}>
      {mode !== 'list' ? (
        <ScheduleForm
          workflows={workflows}
          initial={editing}
          submitting={busy === 'save'}
          onSubmit={createOrUpdate}
          onCancel={() => { setMode('list'); setEditing(null); }}
        />
      ) : (
        <div className="sch-list">
          {!workflows.length && (
            <p className="panel-note">{t('schedule.noWorkflows')}</p>
          )}
          {workflows.length > 0 && !schedules.length && (
            <div className="sch-empty">
              <p className="panel-note">{t('schedule.noSchedules')}</p>
              <p className="sec-hint">{t('schedule.stepsHint')}</p>
            </div>
          )}
          {schedules.length > 0 && (
            <div className="sch-rows">
              {schedules.map((row) => (
                <div key={row.key} className={`sch-row ${row.enabled ? '' : 'sch-row-off'}`}>
                  <div className="sch-row-main">
                    <div className="sch-row-title">
                      <strong>{row.workflowName}</strong>
                      {!row.enabled && <span className="badge">{t('schedule.disabled')}</span>}
                      {row.workflowMissing && <span className="badge badge-danger">{t('schedule.workflowMissing')}</span>}
                    </div>
                    <div className="sch-row-meta">
                      <span title={row.cron}>{describeCron(row.cron) || row.cron}</span>
                      <span>{t('schedule.nextAt', { time: formatNextInZone(row.nextAt, row.timezone) })}</span>
                      <span>{row.timezone ? t('schedule.timezone', { timezone: row.timezone }) : t('schedule.followHost', { timezone: hostTimezone() })}</span>
                      <span>{t('schedule.fired', { count: row.fireCount ?? 0 })}{row.skippedCount ? ` (${t('schedule.skipped', { count: row.skippedCount })})` : ''}{row.misfireCount ? ` (${t('schedule.misfires', { count: row.misfireCount })})` : ''}</span>
                      <span>{row.overlap === 'parallel' ? t('schedule.overlapParallelShort') : t('schedule.overlapSkipShort')}</span>
                      {row.misfirePolicy === 'catchUp' && <span>{t('schedule.catchUpShort')}</span>}
                    </div>
                  </div>
                  <div className="sch-row-actions">
                    <button className="btn btn-sm" disabled={Boolean(busy) || row.workflowMissing} onClick={() => runNow(row)} title={t('schedule.runOnceTitle')}>
                      {busy === `run:${row.key}` ? t('status.running') : t('schedule.runNow')}
                    </button>
                    <button className="btn btn-sm" disabled={Boolean(busy)} onClick={() => toggleEnabled(row)}>
                      {busy === `toggle:${row.key}` ? '…' : row.enabled ? t('schedule.disable') : t('schedule.enable')}
                    </button>
                    <button className="btn btn-sm" disabled={Boolean(busy)} onClick={() => { setEditing(row); setMode('edit'); }}>{t('action.edit')}</button>
                    <button className="btn btn-sm btn-danger" disabled={Boolean(busy)} onClick={() => setConfirmDelete(row)}>{t('action.delete')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {workflows.length > 0 && (
            <div className="sch-footer">
              <button className="btn btn-primary" onClick={startCreate} disabled={Boolean(busy)}>＋ {t('schedule.newTitle')}</button>
            </div>
          )}
          {confirmDelete && (
            <div className="sch-confirm">
              <p>{t('schedule.confirmDelete', { workflow: confirmDelete.workflowName, cron: confirmDelete.cron })}</p>
              <div className="sch-form-actions">
                <button className="btn" onClick={() => setConfirmDelete(null)}>{t('action.cancel')}</button>
                <button className="btn btn-danger" disabled={busy === `del:${confirmDelete.key}`} onClick={() => doDelete(confirmDelete.key)}>
                  {busy === `del:${confirmDelete.key}` ? t('schedule.deleting') : t('schedule.confirmDeleteButton')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
