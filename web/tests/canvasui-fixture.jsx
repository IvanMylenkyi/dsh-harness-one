import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

window.__ModuleLoader__ = {
  load({ factory }) {
    window.__canvasUiClient = factory((name) => {
      if (name === 'react') return React;
      throw new Error(`unexpected canvasui dependency: ${name}`);
    });
  },
};

function Fixture() {
  const [locale, setLocale] = useState('en');
  const [client, setClient] = useState(null);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    let alive = true;
    fetch('/canvasui-bundle.js')
      .then((response) => response.text())
      .then((source) => {
        window.eval(source);
        if (alive) setClient(window.__canvasUiClient);
      });
    return () => { alive = false; };
  }, []);

  if (!client) return <div>Loading fixture</div>;
  const { GraphPatchCard, PatchConfirmBar, AgentDefaultsCard, setPatchConfirmState } = client.__test;
  if (!window.__canvasUiPatchSeeded) {
    window.__canvasUiPatchSeeded = true;
    setPatchConfirmState({ state: 'pending', canvasId: 'fixture', version: 1, summary: 'Delete 1 node', deadline: Date.now() + 60_000 });
  }
  const patchBlock = {
    kind: 'tool-result',
    isError: false,
    call: { name: 'canvas_graph_patch', argsRaw: JSON.stringify({ ops: [{ op: 'addNode' }] }) },
    content: [{ type: 'text', text: '已应用 1 个操作到画布。\nlint: 通过' }],
  };
  return (
    <>
      <label>Fixture language <select aria-label="Fixture language" value={locale} onChange={(event) => setLocale(event.target.value)}>
        <option value="en">English</option><option value="zh-CN">简体中文</option>
      </select></label>
      <section aria-label="Canvas cards">
        <GraphPatchCard block={patchBlock} />
        <PatchConfirmBar onDecide={() => {}} />
      </section>
      <section aria-label="Workflow One settings"><AgentDefaultsCard /></section>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Fixture />);
