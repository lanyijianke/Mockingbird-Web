/**
 * 统一时间工具模块
 * 所有日期格式化强制使用 Asia/Shanghai 时区 (UTC+8)
 * 避免 SSR 部署在非中国时区服务器时显示错误时间
 */

const TIMEZONE = 'Asia/Shanghai';

function normalizeStoredDateTime(dateStr: string): string {
  if (dateStr.includes('T')) {
    return dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
  }

  return `${dateStr.replace(' ', 'T')}Z`;
}

export function parseUtcStorageDate(dateStr?: string | null): Date | null {
  if (!dateStr) {
    return null;
  }

  const parsed = new Date(normalizeStoredDateTime(dateStr));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatUtcStorageDateTimeBeijing(dateStr?: string | null): string | null {
  const parsed = parseUtcStorageDate(dateStr);
  if (!parsed) {
    return null;
  }

  return parsed.toLocaleString('zh-CN', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化为北京时间的英文日期 (e.g. "MAR 11, 2026")
 */
export function formatBeijingDate(dateStr: string): string {
  const d = new Date(dateStr);
  // 使用 en-US locale + Asia/Shanghai 时区获取准确的年月日
  const parts = d.toLocaleDateString('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  // en-US short month 格式: "Mar 11, 2026"
  const match = parts.match(/(\w+)\s+(\d+),\s+(\d+)/);
  if (match) {
    return `${match[1].toUpperCase()} ${match[2]}, ${match[3]}`;
  }
  return parts;
}

/**
 * 格式化为北京时间的短日期 (e.g. "2026.03.11")
 */
export function formatBeijingShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = Number(d.toLocaleDateString('en-US', { timeZone: TIMEZONE, year: 'numeric' }));
  const month = String(Number(d.toLocaleDateString('en-US', { timeZone: TIMEZONE, month: 'numeric' }))).padStart(2, '0');
  const day = String(Number(d.toLocaleDateString('en-US', { timeZone: TIMEZONE, day: 'numeric' }))).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

/**
 * 格式化为北京时间的中文日期 (e.g. "2026年3月11日")
 */
export function formatBeijingDateCN(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
