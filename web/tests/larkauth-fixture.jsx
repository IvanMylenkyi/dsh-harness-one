import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

window.__ModuleLoader__ = {
  load({ factory }) {
    window.__larkAuthClient = factory((name) => {
      if (name === 'react') return React;
      throw new Error(`unexpected larkauth dependency: ${name}`);
    });
  },
};

function Fixture() {
  const [locale, setLocale] = useState('en');
  const [section, setSection] = useState(null);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    let alive = true;
    fetch('/larkauth-bundle.js')
      .then((response) => response.text())
      .then((source) => {
        window.eval(source);
        const registered = {};
        const slots = {
          inject(_name, callback) { callback(); },
          register(definition, component) {
            registered[definition.id] = component;
            return component;
          },
        };
        window.__larkAuthClient.apply({ slots });
        if (alive) setSection(() => registered['lark-auth']);
      });
    return () => { alive = false; };
  }, []);

  if (!section) return <div>Loading fixture</div>;
  const LarkAuthSection = section;
  return (
    <>
      <label>Fixture language <select aria-label="Fixture language" value={locale} onChange={(event) => setLocale(event.target.value)}>
        <option value="en">English</option><option value="zh-CN">简体中文</option>
      </select></label>
      <section aria-label="Lark installation state">
        <LarkAuthSection initialStatus={{ installed: false, installing: false, runtime: 'ordinary' }} />
      </section>
      <section aria-label="Lark signed-in state">
        <LarkAuthSection initialStatus={{
          installed: true,
          user: { userName: 'Ada', tokenStatus: 'valid', expiresAt: '2030-01-02T03:04:00Z' },
          autoRenew: { lastAt: '2030-01-01T03:04:00Z', lastResult: 'renewed' },
          appId: 'app-fixture',
          defaultIdentity: 'Ada',
          bot: { status: 'ok' },
        }} />
      </section>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Fixture />);
