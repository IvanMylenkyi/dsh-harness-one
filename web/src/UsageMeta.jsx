// 用量展示组件（#64）：节点详情 meta 区 / 成果面板运行级合计共用。
// 口径防误读（issue 核心诉求）：
// - 输入列是「未命中缓存部分」，总输入读取 = input + cacheRead；
// - cacheRead/cacheWrite 计价与全价不同（通常 ~0.1x / ~1.25x），不得拿 token 数直接乘单价算钱；
// - 上游未回报 usage（部分流式调用被砍/provider 未回）时显示「用量无记录」，绝不渲染成 0。
import { formatTokens } from './usage-format.js';
import { useI18n } from './i18n/index.js';

export function UsageMeta({ usage, title }) {
  const { t } = useI18n();
  if (!usage || typeof usage !== 'object') {
    return <span className="usage-meta usage-none" title={t('usage.noRecord')}>{t('usage.noRecord')}</span>;
  }
  const usageTitle = title || t('usage.title');
  return (
    <span className="usage-meta" title={usageTitle}>
      <span className="usage-out" title={t('usage.outputTokens')}>↑{formatTokens(usage.outputTokens)}</span>
      <span className="usage-in" title={t('usage.inputTokens')}>↓{formatTokens(usage.inputTokens)}</span>
      {usage.cacheReadTokens ? <span className="usage-cache" title={t('usage.cacheRead')}>⇦{formatTokens(usage.cacheReadTokens)}</span> : null}
      {usage.cacheWriteTokens ? <span className="usage-cache" title={t('usage.cacheWrite')}>⇨{formatTokens(usage.cacheWriteTokens)}</span> : null}
    </span>
  );
}
