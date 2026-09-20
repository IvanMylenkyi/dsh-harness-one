// 所见即所得文稿编辑器（直接编辑通道，issue #97）：
// Tiptap v2 + tiptap-markdown——打开即排版文档，直接改字/改表格/调格式，
// 用户不需要懂 Markdown；保存时序列化回 Markdown 落版本链（与 AI 修订同链）。
// 表格：Tiptap 官方 table 扩展（悬浮 +/= 控行列、Tab 切格、表头行列）。
import { useCallback, useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Markdown } from 'tiptap-markdown';
import { useI18n } from './i18n/index.js';

export const RICH_DOC_EXTENSIONS = [
  StarterKit,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
  Image,
  Link.configure({ openOnClick: false }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
];

/** 工具条按钮规格：active 判定与动作（编辑器实例方法安全调用） */
function toolbarState(editor, t) {
  return [
    { key: 'bold', label: 'B', titleKey: 'richDoc.bold', className: 'rde-btn-b', active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { key: 'italic', label: 'I', titleKey: 'richDoc.italic', className: 'rde-btn-i', active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { key: 'strike', label: 'S', titleKey: 'richDoc.strike', className: 'rde-btn-s', active: editor.isActive('strike'), run: () => editor.chain().focus().toggleStrike().run() },
    { key: 'code', label: '</>', titleKey: 'richDoc.code', active: editor.isActive('code'), run: () => editor.chain().focus().toggleCode().run() },
    { sep: true },
    { key: 'h1', label: 'H1', titleKey: 'richDoc.heading1', active: editor.isActive('heading', { level: 1 }), run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: 'h2', label: 'H2', titleKey: 'richDoc.heading2', active: editor.isActive('heading', { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'h3', label: 'H3', titleKey: 'richDoc.heading3', active: editor.isActive('heading', { level: 3 }), run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { sep: true },
    { key: 'bullet', label: '•', titleKey: 'richDoc.bulletList', active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { key: 'ordered', label: '1.', titleKey: 'richDoc.orderedList', active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: 'task', label: '☑', titleKey: 'richDoc.taskList', active: editor.isActive('taskList'), run: () => editor.chain().focus().toggleTaskList().run() },
    { key: 'quote', label: '❝', titleKey: 'richDoc.quote', active: editor.isActive('blockquote'), run: () => editor.chain().focus().toggleBlockquote().run() },
    { key: 'codeblock', label: '{ }', titleKey: 'richDoc.codeBlock', active: editor.isActive('codeBlock'), run: () => editor.chain().focus().toggleCodeBlock().run() },
    { sep: true },
    { key: 'link', label: '🔗', titleKey: 'richDoc.link', active: editor.isActive('link'), run: () => {
      const url = window.prompt(t('richDoc.linkPrompt'), editor.getAttributes('link').href || 'https://');
      if (url == null) return;
      if (!url) { editor.chain().focus().unsetLink().run(); return; }
      editor.chain().focus().setLink({ href: url }).run();
    } },
    { key: 'hr', label: '―', titleKey: 'richDoc.horizontalRule', active: false, run: () => editor.chain().focus().setHorizontalRule().run() },
    { key: 'undo', label: '↩', titleKey: 'richDoc.undo', active: false, run: () => editor.chain().focus().undo().run() },
    { key: 'redo', label: '↪', titleKey: 'richDoc.redo', active: false, run: () => editor.chain().focus().redo().run() },
  ];
}

function tableState(editor) {
  if (!editor.isActive('table')) return null;
  return [
    { key: 'add-row', labelKey: 'richDoc.addRowLabel', titleKey: 'richDoc.addRow', run: () => editor.chain().focus().addRowAfter().run() },
    { key: 'del-row', labelKey: 'richDoc.deleteRowLabel', titleKey: 'richDoc.deleteRow', run: () => editor.chain().focus().deleteRow().run() },
    { key: 'add-col', labelKey: 'richDoc.addColumnLabel', titleKey: 'richDoc.addColumn', run: () => editor.chain().focus().addColumnAfter().run() },
    { key: 'del-col', labelKey: 'richDoc.deleteColumnLabel', titleKey: 'richDoc.deleteColumn', run: () => editor.chain().focus().deleteColumn().run() },
    { key: 'header-row', labelKey: 'richDoc.headerRowLabel', titleKey: 'richDoc.headerRow', active: editor.isActive('tableHeader'), run: () => editor.chain().focus().toggleHeaderRow().run() },
    { key: 'merge', labelKey: 'richDoc.mergeCellsLabel', titleKey: 'richDoc.mergeCells', run: () => editor.chain().focus().mergeCells().run() },
    { key: 'split', labelKey: 'richDoc.splitCellLabel', titleKey: 'richDoc.splitCell', run: () => editor.chain().focus().splitCell().run() },
  ];
}

export function RichDocEditor({ initialMarkdown, onChange, onReady }) {
  const { t } = useI18n();
  const [tick, setTick] = useState(0); // 编辑器选区/格式态变化 → 重渲染工具条

  // deps 留空：只在挂载时解析底稿（受控状态放外面）。若把 initialMarkdown 放进依赖，
  // 每次击键 onChange 更新草稿都会重建编辑器——光标跳回文档开头，连续输入不可用。
  // 换底稿由宿主用 key 重挂载（FeedbackDrawer 的 draft key）。
  const editor = useEditor({
    extensions: RICH_DOC_EXTENSIONS,
    content: initialMarkdown, // Markdown 扩展解析 md 字符串为文档
    editorProps: { attributes: { class: 'rde-prose', spellcheck: 'false' } },
    onUpdate: ({ editor: e }) => onChange?.(e.storage.markdown.getMarkdown()),
    onSelectionUpdate: () => setTick((t) => t + 1),
    onTransaction: () => setTick((t) => t + 1),
  });

  // 保存快捷键：Cmd/Ctrl+S 交给宿主处理（FeedbackDrawer 的保存按钮逻辑）
  useEffect(() => { onReady?.(editor); }, [editor, onReady]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    setTick((t) => t + 1);
  }, [editor]);

  if (!editor) return <div className="rde-loading">{t('richDoc.loading')}</div>;
  const bar = toolbarState(editor, t);
  const table = tableState(editor);
  void tick; // tick 仅驱动重渲染

  return (
    <div className="rde">
      <div className="rde-toolbar" role="toolbar" aria-label={t('richDoc.toolbar')}>
        {bar.map((item, i) => (item.sep
          ? <span key={`sep${i}`} className="rde-sep" />
          : (
            (() => { const title = t(item.titleKey); return (
            <button
              key={item.key} type="button" className={`rde-btn ${item.className || ''} ${item.active ? 'rde-btn-on' : ''}`}
              title={title} aria-label={title} aria-pressed={item.active}
              onMouseDown={(e) => e.preventDefault()} // 保住编辑器焦点
              onClick={item.run}
                >{item.labelKey ? t(item.labelKey) : item.label}</button>); })()
          )))}
        {!table && <button type="button" className="rde-btn" title={t('richDoc.insertTable')} aria-label={t('richDoc.insertTable')} onMouseDown={(e) => e.preventDefault()} onClick={insertTable}>▦</button>}
        {table && (
          <span className="rde-table-tools">
            {table.map((item) => (
              <button
                key={item.key} type="button" className={`rde-btn ${item.active ? 'rde-btn-on' : ''}`}
                title={t(item.titleKey)} aria-label={t(item.titleKey)}
                onMouseDown={(e) => e.preventDefault()} onClick={() => { item.run(); setTick((t) => t + 1); }}
              >{t(item.labelKey)}</button>
            ))}
          </span>
        )}
      </div>
      <EditorContent editor={editor} className="rde-body" />
    </div>
  );
}
