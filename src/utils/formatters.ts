import { CurrencyDisplayUnit } from '../types';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Converts Persian (۰-۹) and Arabic (٠-٩) digits to ASCII (0-9) and parses safely.
 */
export function parseLocaleNumber(input: string | number): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : 0;
  }
  const normalized = String(input)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٬,،\s]/g, '')
    .replace(/٫/g, '.')
    .replace(/−/g, '-');

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

export function formatDigits(input: string | number, usePersian = true): string {
  return usePersian ? toPersianDigits(input) : String(input);
}

export function formatNumber(
  value: number,
  options?: { decimals?: number; usePersian?: boolean }
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const decimals = options?.decimals ?? 0;
  const usePersian = options?.usePersian ?? true;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
  return formatDigits(formatted, usePersian);
}

export function formatCurrency(
  tomanAmount: number,
  unit: CurrencyDisplayUnit = 'toman',
  usePersian = true,
  compact = false
): string {
  const safe = Number.isFinite(tomanAmount) ? tomanAmount : 0;
  const sign = safe < 0 ? '-' : '';
  const absVal = Math.abs(safe);

  if (unit === 'rial') {
    const rialVal = absVal * 10;
    if (compact && rialVal >= 1_000_000_000) {
      return `${sign}${formatNumber(rialVal / 1_000_000_000, { decimals: 1, usePersian })} میلیارد ریال`;
    }
    if (compact && rialVal >= 1_000_000) {
      return `${sign}${formatNumber(rialVal / 1_000_000, { decimals: 1, usePersian })} م.ریال`;
    }
    return `${sign}${formatNumber(Math.round(rialVal), { usePersian })} ریال`;
  }

  if (unit === 'million_toman') {
    const millionVal = absVal / 1_000_000;
    return `${sign}${formatNumber(millionVal, { decimals: millionVal >= 100 ? 1 : 2, usePersian })} میلیون تومان`;
  }

  // Default: Toman
  if (compact && absVal >= 1_000_000_000) {
    return `${sign}${formatNumber(absVal / 1_000_000_000, { decimals: 2, usePersian })} میلیارد ت`;
  }
  if (compact && absVal >= 1_000_000) {
    return `${sign}${formatNumber(absVal / 1_000_000, { decimals: 1, usePersian })} م.تومان`;
  }
  return `${sign}${formatNumber(Math.round(absVal), { usePersian })} تومان`;
}

export function formatShortToman(tomanAmount: number, usePersian = true): string {
  const safe = Number.isFinite(tomanAmount) ? tomanAmount : 0;
  const sign = safe < 0 ? '-' : '';
  const absVal = Math.abs(safe);
  if (absVal >= 1_000_000_000) {
    return `${sign}${formatNumber(absVal / 1_000_000_000, { decimals: 1, usePersian })}B`;
  }
  if (absVal >= 1_000_000) {
    return `${sign}${formatNumber(absVal / 1_000_000, { decimals: 1, usePersian })}M`;
  }
  if (absVal >= 1_000) {
    return `${sign}${formatNumber(Math.round(absVal / 1_000), { usePersian })}K`;
  }
  return `${sign}${formatNumber(Math.round(absVal), { usePersian })}`;
}

export function formatPercent(value: number, usePersian = true, decimals = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${formatNumber(safe, { decimals, usePersian })}٪`;
}

export function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(step) || step <= 0) return Math.round(value);
  return Math.ceil(value / step) * step;
}

export function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

export function exportUtf8Csv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
