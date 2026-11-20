import {
  ComputedWorkshopSummary,
  ForecastMonthPoint,
  WorkshopData,
} from '../types';
import { computeTrueMonthlyStaffCost } from '../utils/costEngine';

export interface SyncResult {
  ok: boolean;
  message: string;
  syncedAt?: string;
  state?: WorkshopData;
}

/**
 * Push relational tables + full JSON backup to Google Apps Script Webhook.
 * Strictly uses text/plain;charset=utf-8 to avoid CORS preflight failures.
 */
export async function pushToGoogleSheets(
  webhookUrl: string,
  data: WorkshopData,
  summary: ComputedWorkshopSummary,
  forecast: ForecastMonthPoint[]
): Promise<SyncResult> {
  const url = webhookUrl.trim();
  if (!url) {
    return { ok: false, message: 'لطفاً ابتدا نشانی Web App گوگل شیت را در تنظیمات وارد کنید.' };
  }

  const payload = {
    action: 'push',
    workshopName: data.settings.workshopName,
    state: data,
    tables: {
      ingredients: data.ingredients.map((i) => [
        i.id,
        i.name,
        i.category,
        i.packLabel,
        i.packQuantityInBase,
        i.baseUnit,
        i.packPrice,
        i.monthlyInflationPct,
        i.currentStockInBase,
        i.safetyStockInBase,
      ]),
      recipes: summary.recipeMetrics.map((r) => [
        r.recipeId,
        r.name,
        r.category,
        Math.round(r.totalCostPerKg),
        Math.round(r.storefrontPricePerKg),
        Math.round(r.netProfitPerKg),
        Number(r.netMarginPct.toFixed(1)),
        r.monthlySalesKg,
        Math.round(r.profitPerOvenHour),
        data.recipes.find((x) => x.id === r.recipeId)?.unionPriceCeiling ?? '-',
      ]),
      overheadPayroll: [
        ...data.staff.map((s) => {
          const c = computeTrueMonthlyStaffCost(s);
          return [
            'پرسنل',
            s.name,
            s.role,
            Math.round(c.baseAndBenefits),
            Math.round(c.insurance23 + c.eidiAccrual + c.sanavatAccrual),
            Math.round(c.totalTrueCost),
          ];
        }),
        ...data.overheads.map((o) => [
          'سربار ثابت',
          o.name,
          o.category,
          Math.round(o.monthlyAmount),
          0,
          Math.round(o.monthlyAmount),
        ]),
      ],
      checks: data.checks.map((c) => [
        c.type === 'issued' ? 'پرداختی' : 'دریافتی',
        c.counterparty,
        c.amount,
        c.dueDateShamsi,
        c.sayadiId,
        c.status,
      ]),
      forecast: forecast.map((f) => [
        f.shamsiName,
        f.occasion,
        f.seasonalMultiplier,
        f.revenueBase,
        f.totalCostBase,
        f.profitBase,
        f.profitP10,
        f.profitP90,
        f.realProfitBase,
      ]),
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let parsed: { ok?: boolean; error?: string; syncedAt?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // Apps Script redirect or opaque text response
      if (res.ok) {
        return {
          ok: true,
          message: 'اطلاعات کارگاه با موفقیت به ۶ تب گوگل شیت ارسال شد.',
          syncedAt: new Date().toISOString(),
        };
      }
    }

    if (parsed.ok) {
      return {
        ok: true,
        message: 'همگام‌سازی دوطرفه با ۶ تب گوگل شیت با موفقیت انجام شد.',
        syncedAt: parsed.syncedAt ?? new Date().toISOString(),
      };
    }

    return {
      ok: false,
      message: parsed.error || `خطا در پاسخ گوگل شیت (کد ${res.status})`,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `خطای اتصال به گوگل شیت: ${err.message}`
          : 'اتصال به وب‌هوک گوگل شیت برقرار نشد.',
    };
  }
}

export async function pullFromGoogleSheets(webhookUrl: string): Promise<SyncResult> {
  const url = webhookUrl.trim();
  if (!url) {
    return { ok: false, message: 'لطفاً ابتدا نشانی Web App گوگل شیت را وارد کنید.' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'pull' }),
    });
    const parsed = (await res.json()) as {
      ok?: boolean;
      error?: string;
      updatedAt?: string;
      state?: WorkshopData;
    };
    if (parsed.ok && parsed.state && parsed.state.settings && Array.isArray(parsed.state.ingredients)) {
      return {
        ok: true,
        message: 'آخرین نسخه پشتیبان از گوگل شیت بازیابی شد.',
        syncedAt: parsed.updatedAt ?? new Date().toISOString(),
        state: parsed.state,
      };
    }
    return { ok: false, message: parsed.error || 'داده معتبری در تب App_State_Backup یافت نشد.' };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `خطا در دریافت از گوگل شیت: ${err.message}`
          : 'دریافت اطلاعات از گوگل شیت ناموفق بود.',
    };
  }
}
