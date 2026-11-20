import React, { useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { useWorkshop } from '../../store/WorkshopContext';
import {
  exportUtf8Csv,
  formatCurrency,
  formatDigits,
  formatNumber,
  formatPercent,
} from '../../utils/formatters';
import { PrivacyValue } from '../../components/PrivacyValue';

export const ReportsView: React.FC = () => {
  const { data, summary, monteCarlo, tornado, notify } = useWorkshop();
  const { settings } = data;
  const usePersian = settings.usePersianDigits;
  const fmt = (v: number, compact = false) =>
    formatCurrency(v, settings.currencyUnit, usePersian, compact);

  const [mode, setMode] = useState<'executive' | 'audit'>('executive');

  const handleExportFullCsv = () => {
    exportUtf8Csv(
      `گزارش-مالی-${settings.workshopName}`,
      [
        'نام محصول',
        'دسته',
        'بهای تمام‌شده/کیلو',
        'قیمت ویترین/کیلو',
        'سود خالص/کیلو',
        'حاشیه سود (%)',
        'فروش ماهانه (کیلو)',
        'سود خالص ماهانه',
        'سود در ساعت فر',
        'وضعیت سقف اتحادیه',
      ],
      summary.recipeMetrics.map((r) => [
        r.name,
        r.category,
        Math.round(r.totalCostPerKg),
        Math.round(r.storefrontPricePerKg),
        Math.round(r.netProfitPerKg),
        Number(r.netMarginPct.toFixed(1)),
        r.monthlySalesKg,
        Math.round(r.monthlyNetProfit),
        Math.round(r.profitPerOvenHour),
        r.unionCeilingStatus,
      ])
    );
    notify('فایل اکسل فارسی (UTF-8 BOM) با موفقیت دانلود شد.');
  };

  return (
    <div className="space-y-4">
      {/* Control Toolbar (Hidden on Print) */}
      <div className="no-print bg-white border border-[#EAE2D8] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('executive')}
            className={`px-3.5 py-1.5 rounded-md font-bold cursor-pointer ${
              mode === 'executive' ? 'bg-[#2B1E1A] text-white' : 'text-[#5A4A42]'
            }`}
          >
            خلاصه مدیریتی ۱ صفحه‌ای
          </button>
          <button
            type="button"
            onClick={() => setMode('audit')}
            className={`px-3.5 py-1.5 rounded-md font-bold cursor-pointer ${
              mode === 'audit' ? 'bg-[#2B1E1A] text-white' : 'text-[#5A4A42]'
            }`}
          >
            گزارش جامع ممیزی کارگاه
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportFullCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#EAE2D8] bg-[#FAF8F5] hover:bg-[#EFE7DC] text-xs font-bold text-[#2B1E1A] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی اکسل فارسی (CSV)</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ PDF برندشده (A4)</span>
          </button>
        </div>
      </div>

      {/* Printable Branded Document */}
      <article className="print-container bg-white border border-[#EAE2D8] rounded-2xl p-6 lg:p-8 space-y-6">
        {/* Branded Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#2B1E1A] pb-4">
          <div className="flex items-center gap-3">
            {settings.logoBase64 ? (
              <img
                src={settings.logoBase64}
                alt={settings.workshopName}
                className="w-12 h-12 rounded-xl object-cover border border-[#EAE2D8]"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#2B1E1A] text-[#FBBF24] flex items-center justify-center font-extrabold text-xl">
                ش
              </div>
            )}
            <div>
              <h2 className="text-lg font-extrabold text-[#2B1E1A]">{settings.workshopName}</h2>
              <div className="text-xs text-[#6E5C54]">
                {mode === 'executive'
                  ? 'گزارش خلاصه مدیریتی سود واقعی و ریسک'
                  : 'گزارش جامع ممیزی بهای تمام‌شده، منو، تورم و مونت‌کارلو'}
              </div>
            </div>
          </div>
          <div className="text-left text-xs text-[#5A4A42] space-y-0.5">
            <div className="font-bold text-[#2B1E1A]">مدیر مسئول: {settings.managerName}</div>
            {settings.phone && <div>تلفن: {settings.phone}</div>}
            <div className="text-[#2D6A4F] font-bold tabular-nums">
              امتیاز سلامت مالی: {formatDigits(summary.healthScore, usePersian)} / ۱۰۰ ({summary.masteryRank})
            </div>
          </div>
        </header>

        {/* Real vs Nominal Reconciliation Grid */}
        <section className="print-break-inside-avoid">
          <h3 className="text-sm font-extrabold text-[#2B1E1A] mb-3 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#2D6A4F]" />
            <span>صورت تطبیق سود اسمی و سود واقعی قابل برداشت</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs tabular-nums">
            <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE2D8] p-3.5">
              <div className="text-[#6E5C54]">درآمد کل ماهانه</div>
              <div className="text-base font-extrabold text-[#2B1E1A] mt-1">
                <PrivacyValue>{fmt(summary.totalMonthlyRevenue, true)}</PrivacyValue>
              </div>
            </div>
            <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE2D8] p-3.5">
              <div className="text-[#6E5C54]">سود اسمی (روی کاغذ)</div>
              <div className="text-base font-extrabold text-[#2B1E1A] mt-1">
                <PrivacyValue>{fmt(summary.nominalMonthlyProfit, true)}</PrivacyValue>
              </div>
            </div>
            <div className="rounded-xl bg-[#FFFBEB] border border-[#F5D08A] p-3.5">
              <div className="text-[#92400E]">ذخیره تورم انبار + سپر رکود</div>
              <div className="text-base font-extrabold text-[#B45309] mt-1">
                <PrivacyValue>
                  {fmt(summary.inventoryReplacementReserve + summary.monthlySlumpReserve, true)}
                </PrivacyValue>
              </div>
            </div>
            <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] p-3.5">
              <div className="text-[#065F46] font-bold">سود واقعی قابل برداشت</div>
              <div className="text-base font-extrabold text-[#1B4332] mt-1">
                <PrivacyValue>{fmt(summary.realSafeOwnerDraw, true)}</PrivacyValue>
              </div>
            </div>
          </div>
        </section>

        {/* SKU Financial Matrix */}
        <section className="print-break-inside-avoid">
          <h3 className="text-sm font-extrabold text-[#2B1E1A] mb-2.5">
            ماتریس بهای تمام‌شده، سود و انطباق اتحادیه محصولات
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[#2B1E1A] text-[#2B1E1A]">
                  <th className="py-2 px-2 font-bold">محصول</th>
                  <th className="py-2 px-2 font-bold">بهای کل/کیلو</th>
                  <th className="py-2 px-2 font-bold">قیمت ویترین</th>
                  <th className="py-2 px-2 font-bold">حاشیه سود</th>
                  <th className="py-2 px-2 font-bold">فروش (کیلو)</th>
                  <th className="py-2 px-2 font-bold">سود/ساعت فر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE2D8]">
                {summary.recipeMetrics.map((r) => (
                  <tr key={r.recipeId}>
                    <td className="py-2 px-2 font-bold text-[#2B1E1A]">{r.name}</td>
                    <td className="py-2 px-2 tabular-nums">
                      <PrivacyValue>{fmt(r.totalCostPerKg)}</PrivacyValue>
                    </td>
                    <td className="py-2 px-2 tabular-nums font-semibold">
                      {fmt(r.storefrontPricePerKg)}
                    </td>
                    <td className="py-2 px-2 tabular-nums font-bold">
                      <PrivacyValue>{formatPercent(r.netMarginPct, usePersian)}</PrivacyValue>
                    </td>
                    <td className="py-2 px-2 tabular-nums">
                      {formatNumber(r.monthlySalesKg, { usePersian })}
                    </td>
                    <td className="py-2 px-2 tabular-nums font-semibold text-[#4338CA]">
                      <PrivacyValue>{fmt(r.profitPerOvenHour, true)}</PrivacyValue>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quantitative Risk & Deep Audit Extras */}
        {mode === 'audit' && (
          <>
            <section className="print-break-inside-avoid grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#EAE2D8]">
              <div className="rounded-xl bg-[#EEF2FF]/60 border border-[#C7D2FE] p-4 text-xs space-y-1.5 tabular-nums">
                <h4 className="font-extrabold text-[#312E81] text-sm">
                  خلاصه شبیه‌سازی مونت‌کارلو ({formatNumber(monteCarlo.iterations, { usePersian })} سناریو)
                </h4>
                <div>احتمال سوددهی ماه بعد: <strong>{formatPercent(monteCarlo.probabilityOfProfitPct, usePersian)}</strong></div>
                <div>میانه سود (P50): <strong><PrivacyValue>{fmt(monteCarlo.medianProfit, true)}</PrivacyValue></strong></div>
                <div>بدترین ۵٪ حالت‌ها (VaR 95%): <strong><PrivacyValue>{fmt(monteCarlo.profitAtRisk95, true)}</PrivacyValue></strong></div>
                <div>ریسک کسری نقدینگی چک‌ها: <strong>{formatPercent(monteCarlo.checkDefaultRiskPct, usePersian)}</strong></div>
              </div>

              <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE2D8] p-4 text-xs space-y-1.5 tabular-nums">
                <h4 className="font-extrabold text-[#2B1E1A] text-sm">
                  محرک‌های برتر حساسیت (تورنادو) و خرید (پارتو)
                </h4>
                {tornado.slice(0, 3).map((t, i) => (
                  <div key={t.key}>
                    {formatDigits(i + 1, usePersian)}. {t.label}: دامنه اثر{' '}
                    <strong><PrivacyValue>{fmt(t.totalSpread, true)}</PrivacyValue></strong>
                  </div>
                ))}
                <div className="pt-1 border-t border-[#EAE2D8]">
                  ۳ قلم اول پارتو:{' '}
                  <strong>
                    {summary.paretoIngredients
                      .slice(0, 3)
                      .map((p) => p.name)
                      .join('، ')}
                  </strong>
                </div>
              </div>
            </section>
          </>
        )}
      </article>
    </div>
  );
};
