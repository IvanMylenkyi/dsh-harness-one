// 飞书应用凭据设置弹窗：多套凭据的增删/设默认；secret 不回显。
// 飞书账号扫码登录在 dsh 官方 Web UI 的设置面板（dsh-ccpg-larkauth 插件）。
import { useEffect, useState } from 'react';
import { apiUrl } from './api.js';
import { Modal } from './ui.jsx';
import { useToast } from './ui.jsx';
import { useI18n } from './i18n/index.js';

export function FeishuCredModal({ onClose, onChanged }) {
  const { t } = useI18n();
  const toast = useToast();
  const [list, setList] = useState([]);
  const [envFallback, setEnvFallback] = useState(false);
  const [form, setForm] = useState({ name: '', appId: '', appSecret: '' });
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(apiUrl('/feishu-credentials')).then((r) => r.json())
      .then((d) => { setList(d.credentials || []); setEnvFallback(Boolean(d.envFallback)); })
      .catch(() => {});
  };
  useEffect(load, []);

  const add = async () => {
    if (!form.appId.trim() || !form.appSecret.trim()) { toast(t('credentials.required'), 'error'); return; }
    setBusy(true);
    const res = await fetch(apiUrl('/feishu-credentials'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { toast(d.error || t('credentials.addFailed'), 'error'); return; }
    toast(t('credentials.added', { name: d.credential.name }), 'success');
    setForm({ name: '', appId: '', appSecret: '' });
    load();
    onChanged?.();
  };

  const setDefault = async (id) => {
    await fetch(apiUrl('/feishu-credentials'), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setDefault', id }),
    });
    toast(t('credentials.setDefaultSuccess'), 'success');
    load();
    onChanged?.();
  };

  const remove = async (c) => {
    await fetch(apiUrl(`/feishu-credentials?id=${encodeURIComponent(c.id)}`), { method: 'DELETE' });
    toast(t('credentials.deleted', { name: c.name }), 'warn');
    load();
    onChanged?.();
  };

  return (
    <Modal title={t('credentials.title')} onClose={onClose}>
      <div className="cred-layout">
        <aside className="cred-aside">
          <p className="cred-aside-title">{t('credentials.about')}</p>
          <p className="cred-aside-text">
            {t('credentials.aboutText')}
          </p>
          <ul className="cred-aside-tips">
            <li>{t('credentials.tipMultiple')}</li>
            <li>{t('credentials.tipDefault')}</li>
            <li>{t('credentials.tipSecret')}</li>
            {envFallback && <li>{t('credentials.tipEnvFallback')}</li>}
          </ul>
        </aside>
        <div className="cred-main-col">
          <div className="cred-list">
            <div className="cred-list-head">
              <span>{t('credentials.configured', { count: list.length })}</span>
            </div>
            {list.length === 0 && <div className="cred-empty">{t('credentials.empty')}</div>}
            {list.map((c) => (
              <div key={c.id} className={`cred-row ${c.isDefault ? 'cred-default' : ''}`}>
                <div className="cred-main">
                  <div className="cred-name-line">
                    <strong>{c.name}</strong>
                    {c.isDefault && <span className="cred-default-tag">{t('credentials.default')}</span>}
                  </div>
                  <span className="cred-id">AppID {c.appIdMasked}</span>
                </div>
                <div className="cred-actions">
                  {!c.isDefault && <button className="btn btn-sm" onClick={() => setDefault(c.id)}>{t('credentials.setDefault')}</button>}
                  <button className="btn-icon" title={t('credentials.delete')} aria-label={t('credentials.delete')} onClick={() => remove(c)}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <div className="cred-form">
            <h4>{t('credentials.add')}</h4>
            <div className="cred-form-grid">
              <input className="modal-input" placeholder={t('credentials.namePlaceholder')} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="modal-input" placeholder={t('credentials.appIdPlaceholder')} value={form.appId}
                onChange={(e) => setForm({ ...form, appId: e.target.value.trim() })} />
              <input className="modal-input" type="password" placeholder={t('credentials.secretPlaceholder')} value={form.appSecret}
                onChange={(e) => setForm({ ...form, appSecret: e.target.value.trim() })}
                onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
            </div>
            <div className="cred-form-foot">
              <span className="sec-hint">{t('credentials.requiredHint')}</span>
              <button className="btn btn-primary" disabled={busy} onClick={add}>＋ {t('credentials.add')}</button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
