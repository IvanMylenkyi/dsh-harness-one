import { useEffect, useMemo, useState } from 'react';

const MESSAGES = Object.freeze({
  en: Object.freeze({
    'preview.title': 'Document preview',
    'preview.open': 'Preview',
    'preview.filePreview': 'Preview {name}',
    'preview.loading': 'Preparing preview…',
    'preview.errorBoundary': 'Preview failed to load. Refresh the page and try again.',
    'preview.empty': 'The file is empty.',
    'preview.missingUrl': 'The API did not provide a safe preview URL.',
    'preview.unsupported': 'This file type cannot be previewed. Download legacy DOC and PPT files to view them.',
    'preview.fullscreen': 'Browser fullscreen',
    'preview.exitFullscreen': 'Exit browser fullscreen',
    'preview.download': 'Download original file',
    'preview.close': 'Close preview',
    'error.network': 'The document could not be loaded. Check your connection and try again.',
    'error.notFound': 'The file was not found or was removed with the run history.',
    'error.session': 'The workspace session has expired. Refresh the page and try again.',
    'error.service': 'The document service is temporarily unavailable. Try again later.',
    'error.missingUrl': 'The preview URL is missing, so the document cannot be loaded.',
    'error.size': '{kind} preview exceeds {size} MB.',
    'error.generic': 'The document could not be loaded. Try again later.',
    'pdf.controls': 'PDF viewer controls',
    'pdf.zoomOut': 'Zoom out',
    'pdf.zoomIn': 'Zoom in',
    'pdf.rotate': 'Rotate clockwise',
    'pdf.loading': 'Loading PDF…',
    'pptx.controls': 'PPTX viewer controls',
    'pptx.zoomOut': 'Zoom out',
    'pptx.zoomIn': 'Zoom in',
    'pptx.present': 'Start presentation',
    'pptx.slides': '{count, plural, one {# slide} other {# slides}}',
    'pptx.warning': 'Some complex content may not display completely.',
    'pptx.loading': 'Loading PPTX…',
    'sheet.timeout': 'Workbook parsing timed out. Download the file to view it.',
    'sheet.parseFailed': 'The workbook could not be parsed.',
    'sheet.tabs': 'Worksheets',
    'sheet.search': 'Search cells',
    'sheet.searchPlaceholder': 'Search',
    'sheet.previousPage': 'Previous page',
    'sheet.nextPage': 'Next page',
    'sheet.rowNumber': 'Row number',
    'sheet.loading': 'Loading workbook…',
    'sheet.empty': 'The workbook is empty.',
    'sheet.noMatches': 'No matching cells.',
    'docx.loading': 'Loading DOCX…',
    'univer.gatewayFailed': 'The Univer Office gateway could not be started.',
    'univer.pathFailed': 'The file path could not be encoded.',
    'univer.missingPlugin': 'The dsh-univer-office plugin is not installed, so this .univer file cannot be previewed. Download it and open it with Univer.',
    'univer.missingArtifact': 'The preview URL is missing artifact location data, so the Univer Viewer cannot be opened.',
    'univer.unavailable': 'Univer preview unavailable: {message}',
    'univer.loading': 'Connecting to Univer Viewer…',
  }),
  'zh-CN': Object.freeze({
    'preview.title': '文档预览',
    'preview.open': '预览',
    'preview.filePreview': '预览 {name}',
    'preview.loading': '正在准备预览…',
    'preview.errorBoundary': '预览组件加载失败，请刷新页面后重试。',
    'preview.empty': '文件为空。',
    'preview.missingUrl': '接口未提供安全预览地址。',
    'preview.unsupported': '该文件类型暂不支持预览，旧 DOC 和 PPT 请下载后查看。',
    'preview.fullscreen': '浏览器全屏',
    'preview.exitFullscreen': '退出浏览器全屏',
    'preview.download': '下载原文件',
    'preview.close': '关闭预览',
    'error.network': '文档加载失败，请检查连接后重试。',
    'error.notFound': '文件不存在或已随运行历史清理。',
    'error.session': '当前工作区会话已失效，请刷新页面后重试。',
    'error.service': '文档服务暂时不可用，请稍后重试。',
    'error.missingUrl': '预览地址缺失，无法加载文档。',
    'error.size': '{kind} 预览超过 {size} MB。',
    'error.generic': '文档加载失败，请稍后重试。',
    'pdf.controls': 'PDF 查看控制',
    'pdf.zoomOut': '缩小',
    'pdf.zoomIn': '放大',
    'pdf.rotate': '顺时针旋转',
    'pdf.loading': '正在加载 PDF…',
    'pptx.controls': 'PPTX 查看控制',
    'pptx.zoomOut': '缩小',
    'pptx.zoomIn': '放大',
    'pptx.present': '放映',
    'pptx.slides': '{count, plural, one {# 张幻灯片} other {# 张幻灯片}}',
    'pptx.warning': '部分复杂内容可能无法完整显示',
    'pptx.loading': '正在加载 PPTX…',
    'sheet.timeout': '工作簿解析超时，请下载后查看。',
    'sheet.parseFailed': '工作簿解析失败',
    'sheet.tabs': '工作表',
    'sheet.search': '搜索单元格',
    'sheet.searchPlaceholder': '搜索',
    'sheet.previousPage': '上一页',
    'sheet.nextPage': '下一页',
    'sheet.rowNumber': '行号',
    'sheet.loading': '正在加载工作簿…',
    'sheet.empty': '工作簿为空。',
    'sheet.noMatches': '没有匹配的单元格。',
    'docx.loading': '正在加载 DOCX…',
    'univer.gatewayFailed': 'univer-office Gateway 启动失败',
    'univer.pathFailed': '文件路径编码失败',
    'univer.missingPlugin': '未安装 dsh-univer-office 插件，无法预览 .univer 文件；请下载后用 Univer 打开。',
    'univer.missingArtifact': '预览地址缺少产物定位信息，无法打开 Univer Viewer。',
    'univer.unavailable': 'Univer 预览不可用：{message}',
    'univer.loading': '正在连接 Univer Viewer…',
  }),
});

export function resolvePreviewLocale(value) {
  return String(value || '').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

function interpolate(template, variables = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, name) => variables[name] == null ? `{${name}}` : String(variables[name]));
}

function pluralize(template, variables, locale) {
  const match = String(template).match(/^\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\s*}$/);
  if (!match) return null;
  const count = Number(variables[match[1]] || 0);
  const category = new Intl.PluralRules(locale).select(count);
  return (category === 'one' ? match[2] : match[3]).replaceAll('#', new Intl.NumberFormat(locale).format(count));
}

export function createPreviewTranslator(locale = 'en') {
  const resolved = resolvePreviewLocale(locale);
  const dictionary = MESSAGES[resolved];
  return (key, variables = {}) => {
    const raw = dictionary[key] ?? MESSAGES.en[key] ?? key;
    return interpolate(pluralize(raw, variables, resolved) ?? raw, variables);
  };
}

function detectLocale() {
  return resolvePreviewLocale(globalThis.document?.documentElement?.lang || globalThis.navigator?.language);
}

export function usePreviewI18n(explicitLocale) {
  const [detectedLocale, setDetectedLocale] = useState(detectLocale);
  const locale = resolvePreviewLocale(explicitLocale || detectedLocale);

  useEffect(() => {
    if (explicitLocale || !globalThis.document?.documentElement) return undefined;
    const element = globalThis.document.documentElement;
    const update = () => setDetectedLocale(element.lang || detectLocale());
    update();
    const observer = new MutationObserver(update);
    observer.observe(element, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, [explicitLocale]);

  const t = useMemo(() => createPreviewTranslator(locale), [locale]);
  return { locale, t };
}
