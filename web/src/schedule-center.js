// 定时任务面板纯逻辑：cron 人类可读描述 + 预设映射（可单测）。

export const CRON_PRESETS = [
  { key: 'daily-9', labelKey: 'schedule.preset.daily9', cron: '0 9 * * *' },
  { key: 'hourly', labelKey: 'schedule.preset.hourly', cron: '0 * * * *' },
  { key: 'weekly-mon-9', labelKey: 'schedule.preset.weeklyMon9', cron: '0 9 * * 1' },
  { key: 'weekdays-9', labelKey: 'schedule.preset.weekdays9', cron: '0 9 * * 1-5' },
];

const WEEKDAY_ALIASES = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function part(values, { min, max, unit }) {
  if (values === '*') return { every: true, unit };
  if (values.startsWith('*/')) {
    const step = Number(values.slice(2));
    if (Number.isInteger(step) && step > 0) return { every: step, unit };
    return null;
  }
  const list = [];
  for (const seg of values.split(',')) {
    const range = seg.split('-');
    if (range.length === 2) {
      const lo = Number(range[0]);
      const hi = Number(range[1]);
      if ([lo, hi].every(Number.isInteger) && lo >= min && hi <= max && lo < hi) {
        for (let v = lo; v <= hi; v += 1) list.push(v);
        continue;
      }
      return null;
    }
    const v = Number(seg);
    if (!Number.isInteger(v) || v < min || v > max) return null;
    list.push(v);
  }
  return { values: [...new Set(list)].sort((a, b) => a - b), unit };
}

// 尽力把 5 段 cron 转成稳定描述键；解析不了返回 null（面板回退显示原文）。
export function describeCron(cron) {
  const segments = String(cron || '').trim().split(/\s+/);
  if (segments.length !== 5) return null;
  const minute = part(segments[0], { min: 0, max: 59, unit: 'minute' });
  const hour = part(segments[1], { min: 0, max: 23, unit: 'hour' });
  const dom = part(segments[2], { min: 1, max: 31, unit: 'day' });
  const month = part(segments[3], { min: 1, max: 12, unit: 'month' });
  const dowRaw = segments[4].toLowerCase();
  let dow;
  if (dowRaw === '*') dow = { every: true, unit: 'weekday' };
  else if (/^(sun|mon|tue|wed|thu|fri|sat)(-(sun|mon|tue|wed|thu|fri|sat))?$/.test(dowRaw)) {
    const names = dowRaw.split('-').map((n) => WEEKDAY_ALIASES[n]);
    dow = names.length === 2
      ? { values: [names[0], names[1]], unit: 'weekday' }
      : { values: [names[0]], unit: 'weekday' };
  } else {
    // 周列允许 0-7（0 与 7 都是周日）
    dow = part(dowRaw === '7' ? '0' : dowRaw, { min: 0, max: 6, unit: 'weekday' });
  }
  if (!minute || !hour || !dom || !month || !dow) return null;

  const hm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  // 每天 H:M
  if (hour.values?.length === 1 && dom.every === true && month.every === true && dow.every === true) {
    if (minute.values?.length === 1) return { key: 'schedule.everyDayAt', variables: { time: hm(hour.values[0], minute.values[0]) } };
    if (minute.every === true) return { key: 'schedule.everyMinute' };
    if (minute.every) return { key: 'schedule.everyMinutes', variables: { count: minute.every } };
  }
  // 每小时 第 M 分
  if (hour.every === true && dom.every === true && month.every === true && dow.every === true) {
    if (minute.values?.length === 1) return { key: 'schedule.hourlyAtMinute', variables: { minute: minute.values[0] } };
    if (minute.every === true) return { key: 'schedule.everyMinute' };
    if (minute.every) return { key: 'schedule.everyMinutes', variables: { count: minute.every } };
  }
  // 工作日 H:M（dow 1-5）优先于通用周几组合
  if (dow.values?.length === 5 && dow.values.join(',') === '1,2,3,4,5' && dom.every === true && month.every === true) {
    if (hour.values?.length === 1 && minute.values?.length === 1) return { key: 'schedule.weekdaysAt', variables: { time: hm(hour.values[0], minute.values[0]) } };
    return { key: 'schedule.everyWeekday' };
  }
  // 周几 H:M
  if (dow.values?.length && dom.every === true && month.every === true) {
    if (hour.values?.length === 1 && minute.values?.length === 1) return { key: 'schedule.weekdaysAtNamed', variables: { days: dow.values, time: hm(hour.values[0], minute.values[0]) } };
    return { key: 'schedule.everyWeekdays', variables: { days: dow.values } };
  }
  // 每月几号 H:M
  if (dom.values?.length === 1 && month.every === true && dow.every === true) {
    if (hour.values?.length === 1 && minute.values?.length === 1) return { key: 'schedule.monthlyAt', variables: { day: dom.values[0], time: hm(hour.values[0], minute.values[0]) } };
    return { key: 'schedule.monthlyOn', variables: { day: dom.values[0] } };
  }
  return null;
}

export function presetOfCron(cron) {
  return CRON_PRESETS.find((p) => p.cron === String(cron || '').trim()) || null;
}

// 主机时区名（浏览器端展示「跟随主机」选项时提示具体值）
export function hostTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local timezone';
}

// 时区选择器候选：完整 IANA 列表 + 字面量 UTC 去重置顶（ICU 列表常只有 Etc/UTC，
// 而服务端/直觉都认 'UTC'）；旧浏览器没有 supportedValuesOf 时退到常见几个
export function supportedTimezones() {
  try {
    const all = Intl.supportedValuesOf('timeZone');
    return all.includes('UTC') ? all : ['UTC', ...all];
  } catch {
    return ['UTC', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'America/New_York', 'Europe/London'];
  }
}

// 时区偏移提示：Asia/Shanghai → UTC+08:00（按当前时刻，DST 期偏移随之变化，仅作选择提示）。
// 零偏移统一显示 UTC（部分 ICU 对字面量 UTC 返回 GMT+00:00）
export function timezoneOffsetLabel(tz, now = new Date()) {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!name) return '';
    const label = name.replace(/^GMT/, 'UTC');
    return label === 'UTC+00:00' ? 'UTC' : label;
  } catch {
    return '';
  }
}

// 把 ISO 时间按指定 IANA 时区格式化；tz 为空按浏览器本地时区（与旧行为一致）。
// 非法 tz 名（如手改数据塞入垃圾值）兜底回本地时区，不让面板渲染崩掉
export function formatNextInZone(iso, tz, locale = 'zh-CN') {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return date.toLocaleString(locale, { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz || undefined });
  } catch {
    return date.toLocaleString(locale, { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
