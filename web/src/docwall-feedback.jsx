// 文稿评论与修订（issue #97 P1）：评论数据拉取 + 评论/版本链抽屉。
// 轻通道：POST /wf1/api/artifacts/revise 起改写 run（source='revision'），
// pending 期轮询 /comments 直到 revision_run_id 出现在版本链或 run 失败。
// 直接编辑走所见即所得编辑器（RichDocEditor），保存经 /artifacts/save 落版本链。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from './api.js';
import { RichDocEditor } from './RichDocEditor.jsx';
import { useI18n } from './i18n/index.js';

const POLL_MS = 4000;

function localError(i18nKey, i18nVariables = {}, cause) {
  const error = new Error(i18nKey);
  error.i18nKey = i18nKey;
  error.i18nVariables = i18nVariables;
  if (cause) error.cause = cause;
  return error;
}

function errorText(error, t) {
  return error?.i18nKey ? t(error.i18nKey, error.i18nVariables) : String(error?.message || error || '');
}

export function feedbackKey(doc) {
  return `${doc.nodeId || ''}\u0000${doc.name}`;
}

// run 级评论/修订状态：换 run 重拉；改写 pending 期间轮询
export function useArtifactFeedback(runId, refreshToken = 0) {
  const [feedback, setFeedback] = useState({ comments: [], revisions: [] });
  const [pendingRevisions, setPendingRevisions] = useState(() => new Map()); // key → revisionRunId
  const [revisionErrors, setRevisionErrors] = useState(() => new Map()); // key → { revisionRunId, message }
  const runIdRef = useRef('');
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    if (!runId) return;
    try {
      const res = await fetch(apiUrl(`/comments?runId=${encodeURIComponent(runId)}`));
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!aliveRef.current || runIdRef.current !== runId) return;
      const done = new Set((data.revisions || []).map((r) => r.revision_run_id));
      setFeedback({ comments: data.comments || [], revisions: data.revisions || [] });
      setPendingRevisions((prev) => {
        if (!prev.size) return prev;
        const next = new Map([...prev].filter(([, rid]) => !done.has(rid)));
        return next.size === prev.size ? prev : next;
      });
      setRevisionErrors((prev) => {
        if (!prev.size) return prev;
        const next = new Map([...prev].filter(([, state]) => !done.has(state.revisionRunId)));
        return next.size === prev.size ? prev : next;
      });
    } catch { /* 拉取失败保持现状，轮询会重试 */ }
  }, [runId]);

  // 改写 run 终态但未产出修订（失败/取消）：解除 pending，避免无限轮询
  const sweepSettled = useCallback(async (pendingMap) => {
    for (const [key, rid] of pendingMap) {
      try {
        const res = await fetch(apiUrl(`/runs/detail?id=${encodeURIComponent(rid)}`));
        if (!res.ok) continue;
        const run = await res.json();
        if (run.status === 'running') continue;
        const done = feedback.revisions.some((revision) => revision.revision_run_id === rid);
        setPendingRevisions((prev) => {
          if (prev.get(key) !== rid) return prev;
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        if (!done) {
          const state = run.error
            ? { revisionRunId: rid, message: run.error }
            : run.status === 'success'
              ? { revisionRunId: rid, i18nKey: 'feedback.revisionEmpty' }
              : run.status === 'canceled'
                ? { revisionRunId: rid, i18nKey: 'feedback.revisionCanceled' }
                : { revisionRunId: rid, i18nKey: 'feedback.revisionFailed', i18nVariables: { status: run.status } };
          setRevisionErrors((prev) => new Map(prev).set(key, state));
        }
      } catch { /* 状态查不到：保留 pending，轮询继续 */ }
    }
  }, [feedback.revisions]);

  useEffect(() => {
    aliveRef.current = true;
    runIdRef.current = runId || '';
    setFeedback({ comments: [], revisions: [] });
    setPendingRevisions(new Map());
    setRevisionErrors(new Map());
    if (runId) load();
    return () => { aliveRef.current = false; };
  }, [runId, load]);

  useEffect(() => { if (runId && refreshToken) load(); }, [runId, refreshToken, load]);

  // pending 改写轮询：任一改写 run 未进版本链则持续刷新；终态未产出的 sweep 解除
  useEffect(() => {
    if (!pendingRevisions.size) return undefined;
    sweepSettled(pendingRevisions);
    const timer = setInterval(() => { load(); sweepSettled(pendingRevisions); }, POLL_MS);
    return () => clearInterval(timer);
  }, [pendingRevisions, load, sweepSettled]);
  const byArtifact = useMemo(() => {
    const map = new Map(); // key → { comments: [], revisions: [] }
    const bucket = (nodeId, artifactId) => {
      const key = `${nodeId}\u0000${artifactId}`;
      if (!map.has(key)) map.set(key, { comments: [], revisions: [] });
      return map.get(key);
    };
    for (const c of feedback.comments) bucket(c.node_id, c.artifact_id).comments.push(c);
    for (const r of feedback.revisions) bucket(r.node_id, r.artifact_id).revisions.push(r);
    for (const entry of map.values()) entry.revisions.sort((a, b) => a.id - b.id);
    return map;
  }, [feedback]);

  const addComment = useCallback(async (doc, body) => {
    const res = await fetch(apiUrl('/comments/add'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, nodeId: doc.nodeId, artifactId: doc.name, body }),
    });
    const data = await res.json();
    if (!res.ok) throw (data.error ? new Error(data.error) : localError('feedback.commentFailed'));
    load();
    return data.comment;
  }, [runId, load]);

  const deleteComment = useCallback(async (id) => {
    await fetch(apiUrl('/comments/delete'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  }, [load]);

  const revise = useCallback(async (doc, instruction) => {
    const res = await fetch(apiUrl('/artifacts/revise'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, nodeId: doc.nodeId, artifactId: doc.name, instruction }),
    });
    const data = await res.json();
    if (!res.ok) throw (data.error ? new Error(data.error) : localError('feedback.revisionStartFailed'));
    const key = feedbackKey(doc);
    setRevisionErrors((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    setPendingRevisions((prev) => new Map(prev).set(key, data.revisionRunId));
    return data.revisionRunId;
  }, [runId]);

  // 手工编辑保存：写成 revision_run_id 为空的修订进版本链（不覆盖原稿文件）
  const saveManual = useCallback(async (doc, content) => {
    const res = await fetch(apiUrl('/artifacts/save'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, nodeId: doc.nodeId, artifactId: doc.name, content }),
    });
    const data = await res.json();
    if (!res.ok) throw (data.error ? new Error(data.error) : localError('feedback.saveFailed'));
    load();
    return data.revisionId;
  }, [runId, load]);

  return { byArtifact, pendingRevisions, revisionErrors, addComment, deleteComment, revise, saveManual, reload: load };
}

/* ---------- 评论/版本链抽屉：挂在文稿视图右侧 ---------- */
export function FeedbackDrawer({ doc, runId, feedback, onClose }) {
  const { t } = useI18n();
  const key = feedbackKey(doc);
  const entry = feedback.byArtifact.get(key) || { comments: [], revisions: [] };
  const pendingId = feedback.pendingRevisions.get(key);
  const revisionError = feedback.revisionErrors.get(key);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [viewIndex, setViewIndex] = useState(-1); // -1 原稿；0..n 版本链
  const [draft, setDraft] = useState(null); // { base: -1|0..n, text } 直接编辑草稿；null 未编辑

  const submitComment = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy('comment');
    setError('');
    try { await feedback.addComment(doc, body); setText(''); }
    catch (e) { setError(errorText(e, t)); }
    finally { setBusy(''); }
  };

  const submitRevise = async () => {
    if (busy) return;
    setBusy('revise');
    setError('');
    try { await feedback.revise(doc, text.trim()); setText(''); }
    catch (e) { setError(errorText(e, t)); }
    finally { setBusy(''); }
  };

  // 直接编辑：以「当前查看的版本」为底稿（-1=原稿需先拉全文；修订版直接用入库正文）。
  // 仅 md/markdown：csv/txt 经富文本 markdown 往返会破坏原格式（csv 换行结构、txt 缩进）
  const editableDoc = /\.(md|markdown)$/i.test(doc.name || '');
  const startEdit = async () => {
    if (busy) return;
    setBusy('edit');
    setError('');
    try {
      if (viewIndex === -1) {
        const res = await fetch(doc.downloadUrl);
        if (!res.ok) throw localError('feedback.sourceLoadFailed');
        setDraft({ base: -1, text: await res.text() });
      } else {
        const revision = entry.revisions[viewIndex];
        if (!revision?.content) throw localError('feedback.revisionContentMissing');
        setDraft({ base: viewIndex, text: revision.content });
      }
    } catch (e) { setError(errorText(e, t)); }
    finally { setBusy(''); }
  };

  const saveEdit = async () => {
    if (!draft || busy) return;
    setBusy('save');
    setError('');
    try {
      await feedback.saveManual(doc, draft.text);
      setDraft(null);
      setViewIndex(entry.revisions.length); // 保存后跳到新增的手工版本
    } catch (e) { setError(errorText(e, t)); }
    finally { setBusy(''); }
  };

  const shown = viewIndex >= 0 ? entry.revisions[viewIndex] : null;

  return (
    <aside className="docwall-fb" aria-label={t('feedback.ariaLabel', { name: doc.name })}>
      <header className="docwall-fb-head">
        <strong title={doc.name}>{doc.name}</strong>
        <button type="button" className="btn btn-icon" aria-label={t('feedback.close')} onClick={onClose}>✕</button>
      </header>

      <section className="docwall-fb-sec">
        <div className="docwall-fb-label">
          {t('feedback.comments')}
          {entry.comments.length > 0 && <span className="docwall-fb-cnt">{entry.comments.length}</span>}
        </div>
        <div className="docwall-fb-list">
          {entry.comments.length === 0 && <p className="docwall-fb-empty">{t('feedback.noComments')}</p>}
          {entry.comments.map((c) => (
            <div key={c.id} className="docwall-fb-item">
              <p>{c.body}</p>
              <div className="docwall-fb-meta">
                <span>{new Date(c.created_at).toLocaleString()}</span>
                <button type="button" className="docwall-fb-del" onClick={() => feedback.deleteComment(c.id)}>{t('feedback.deleteComment')}</button>
              </div>
            </div>
          ))}
        </div>
        <textarea
          className="docwall-fb-input" rows={3} placeholder={t('feedback.commentPlaceholder')}
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(); }}
        />
        {error && <p className="docwall-fb-err">{error}</p>}
        <div className="docwall-fb-actions">
          <button type="button" className="btn btn-sm" disabled={!text.trim() || Boolean(busy)} onClick={submitComment}>
            {busy === 'comment' ? '…' : t('feedback.saveComment')}
          </button>
          {doc.kind === 'doc' && (
            <button type="button" className="btn btn-sm btn-primary" disabled={Boolean(busy) || (!entry.comments.length && !text.trim())} onClick={submitRevise} title={t('feedback.reviseTitle')}>
              {pendingId ? t('feedback.revising') : busy === 'revise' ? t('feedback.startingRevision') : t('feedback.revise')}
            </button>
          )}
        </div>
        {pendingId && <p className="docwall-fb-pending">{t('feedback.pendingRevision', { id: pendingId.slice(-6) })}</p>}
        {revisionError && !pendingId && (
          <p className="docwall-fb-err" role="alert">
            {t('feedback.revisionIncomplete')}: {revisionError.i18nKey ? t(revisionError.i18nKey, revisionError.i18nVariables) : revisionError.message}
          </p>
        )}
      </section>

      {doc.kind === 'doc' && (
        <section className="docwall-fb-sec">
          <div className="docwall-fb-label">{t('feedback.revisionChain')}</div>
          {draft ? (
            <div className="docwall-fb-edit">
              <p className="docwall-fb-edit-hint">
                {t('feedback.editHint', { base: draft.base === -1 ? t('feedback.original') : `v${draft.base + 1}` })}
              </p>
              {/* key=base：换底稿重开编辑时强制重挂编辑器（编辑器自身 deps 留空防逐键重建） */}
              <RichDocEditor key={draft.base} initialMarkdown={draft.text} onChange={(markdown) => setDraft((d) => (d ? { ...d, text: markdown } : d))} />
              {error && <p className="docwall-fb-err">{error}</p>}
              <div className="docwall-fb-actions">
                <button type="button" className="btn btn-sm" disabled={Boolean(busy)} onClick={() => { setDraft(null); setError(''); }}>{t('action.cancel')}</button>
                <button type="button" className="btn btn-sm btn-primary" disabled={Boolean(busy) || !draft.text.trim()} onClick={saveEdit}>
                  {busy === 'save' ? t('feedback.saving') : t('feedback.saveRevision')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="docwall-fb-vers">
                <button type="button" className={`docwall-fb-ver ${viewIndex === -1 ? 'docwall-fb-ver-on' : ''}`} onClick={() => setViewIndex(-1)}>{t('feedback.original')}</button>
                {entry.revisions.map((r, i) => (
                <button key={r.id} type="button" className={`docwall-fb-ver ${viewIndex === i ? 'docwall-fb-ver-on' : ''}`}
                    onClick={() => setViewIndex(i)} title={r.summary || ''}>
                    v{i + 1}{r.revision_run_id == null ? ' ✍' : ''} · {new Date(r.created_at).toLocaleTimeString()}
                  </button>
                ))}
                {entry.revisions.length === 0 && <span className="docwall-fb-empty-inline">{t('feedback.noRevisions')}</span>}
              </div>
              {shown && (
                <div className="docwall-fb-preview">
                  {shown.summary && <p className="docwall-fb-summary">{shown.summary}</p>}
                  {shown.content
                    ? <pre className="docwall-fb-content">{shown.content}</pre>
                    : <p className="docwall-fb-empty-inline">{t('feedback.revisionContentMissingHint')}</p>}
                </div>
              )}
              <div className="docwall-fb-actions">
                {editableDoc && (
                  <button type="button" className="btn btn-sm" disabled={Boolean(busy) || !doc.downloadUrl} title={t('feedback.editTitle')}
                    onClick={startEdit}>
                    {busy === 'edit' ? t('feedback.preparing') : t('feedback.editDirect')}
                  </button>
                )}
                {!editableDoc && <span className="docwall-fb-empty-inline">{t('feedback.editUnsupported')}</span>}
              </div>
            </>
          )}
        </section>
      )}
    </aside>
  );
}
