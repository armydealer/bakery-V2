import React, { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Download, Flame, ShoppingCart } from 'lucide-react';
import { useWorkshop } from '../../store/WorkshopContext';
import { computeProductionPlan } from '../../utils/costEngine';
import {
  exportUtf8Csv,
  formatCurrency,
  formatDigits,
  formatNumber,
  formatPercent,
} from '../../utils/formatters';
import { HelpTip } from '../../components/HelpTip';
import { LocaleNumberInput } from '../../components/LocaleNumberInput';
import { PrivacyValue } from '../../components/PrivacyValue';

export const HolidayProductionPlanner: React.FC = () => {
  const { data, summary, notify } = useWorkshop();
  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number, compact = false) =>
    formatCurrency(v, currencyUnit, usePersianDigits, compact);

  const [occasionName, setOccasionName] = useState('پیک فروش شب یلدا (۷ روزه)');
  const [planDays, setPlanDays] = useState<number>(7);
  const [targetsKg, setTargetsKg] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    data.recipes.forEach((r) => {
      map[r.id] = Math.round(r.monthlySalesKg * 0.45);
    });
    return map;
  });

  const applyPreset = (label: string, days: number, factor: number) => {
    setOccasionName(label);
    setPlanDays(days);
    const next: Record<string, number> = {};
    data.recipes.forEach((r) => {
      next[r.id] = Math.round(r.monthlySalesKg * factor);
    });
    setTargetsKg(next);
  };

  const plan = useMemo(
    () => computeProductionPlan(targetsKg, planDays, data, summary),
    [targetsKg, planDays, data, summary]
  );

  const handleExportShoppingCsv = () => {
    exportUtf8Csv(
      `لیست-خرید-${occasionName}`,
      ['ماده اولیه', 'بسته‌بندی بازار', 'نیاز کل (واحد پایه)', 'موجودی فعلی', 'تعداد بسته خریدنی', 'نقدینگی خرید خالص (تومان)'],
      plan.shoppingList.map((row) => [
        row.name,
        row.packLabel,
        Math.round(row.requiredBase),
        Math.round(row.inStockBase),
        row.packsToBuy,
        Math.round(row.netCashNeeded),
      ])
    );
    notify('لیست خرید تجمیعی بازار با فرمت اکسل فارسی (UTF-8 BOM) دانلود شد.');
  };

  return (
    <div className="space-y-5">
      {/* Presets & Horizon */}
      <div className="bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
              <Calendar className="w-4.5 h-4.5 text-[#D97706]" />
              <span>برنامه‌ریز تولید مناسبتی و لیست خرید تجمیعی بازار</span>
              <HelpTip id="productionPlanner" />
            </h2>
            <p className="text-xs text-[#7D6C63] mt-0.5">
              تبدیل خودکار سفارش‌های نوروز، یلدا و رمضان به تعداد کیسه و کارتن خرید، نقدینگی مورد نیاز و هشدار پرشدن فر
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset('پیک فروش شب یلدا (۷ روزه)', 7, 0.45)}
              className="px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] hover:border-[#2D6A4F] text-xs font-bold cursor-pointer"
            >
              سناریوی شب یلدا
            </button>
            <button
              type="button"
              onClick={() => applyPreset('موج طلایی اسفند و نوروز (۱۴ روزه)', 14, 1.35)}
              className="px-3 py-1.5 rounded-lg bg-[#FFFBEB] border border-[#F5D08A] hover:border-[#D97706] text-xs font-bold text-[#92400E] cursor-pointer"
            >
              سناریوی نوروز (اسفند)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('برنامه هفتگی عادی (۷ روزه)', 7, 0.25)}
              className="px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] text-xs font-bold cursor-pointer"
            >
              تولید هفتگی عادی
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-[#4B3B34] mb-1">عنوان برنامه تولید</label>
            <input
              type="text"
              value={occasionName}
              onChange={(e) => setOccasionName(e.target.value)}
              className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs font-semibold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#4B3B34] mb-1">بازه زمانی اجرا (روز)</label>
            <LocaleNumberInput value={planDays} onChange={setPlanDays} min={1} max={30} suffix="روز" />
          </div>
        </div>

        {/* Recipe Kg Targets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {data.recipes.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#2B1E1A] truncate">{r.name}</div>
                <div className="text-[11px] text-[#7D6C63]">{r.category}</div>
              </div>
              <div className="w-28 shrink-0">
                <LocaleNumberInput
                  value={targetsKg[r.id] ?? 0}
                  onChange={(v) => setTargetsKg((p) => ({ ...p, [r.id]: v }))}
                  suffix="کیلو"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capacity Overload Alerts & Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        <div
          className={`rounded-xl border p-4 ${
            plan.ovenOverloadPct > 100
              ? 'bg-[#FEF2F2] border-[#F5C2B8]'
              : 'bg-[#ECFDF5] border-[#A7F3D0]'
          }`}
        >
          <div className="text-xs font-bold flex items-center gap-1.5">
            {plan.ovenOverloadPct > 100 ? (
              <AlertTriangle className="w-4 h-4 text-[#C84B31]" />
            ) : (
              <Flame className="w-4 h-4 text-[#2D6A4F]" />
            )}
            <span>فشار بر ظرفیت فر</span>
          </div>
          <div
            className={`mt-2 text-xl font-extrabold tabular-nums ${
              plan.ovenOverloadPct > 100 ? 'text-[#C84B31]' : 'text-[#2D6A4F]'
            }`}
          >
            {formatPercent(plan.ovenOverloadPct, usePersianDigits, 0)}
          </div>
          <div className="text-[11px] text-[#5A4A42] mt-1 tabular-nums">
            {formatNumber(plan.totalOvenHoursNeeded, { decimals: 1, usePersian: usePersianDigits })} از{' '}
            {formatNumber(plan.availableOvenHours, { usePersian: usePersianDigits })} ساعت فر
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 ${
            plan.laborOverloadPct > 100
              ? 'bg-[#FEF2F2] border-[#F5C2B8]'
              : 'bg-white border-[#EAE2D8]'
          }`}
        >
          <div className="text-xs font-bold text-[#4B3B34] flex items-center gap-1.5">
            {plan.laborOverloadPct > 100 ? (
              <AlertTriangle className="w-4 h-4 text-[#C84B31]" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#2D6A4F]" />
            )}
            <span>فشار بر شیفت پرسنل</span>
          </div>
          <div
            className={`mt-2 text-xl font-extrabold tabular-nums ${
              plan.laborOverloadPct > 100 ? 'text-[#C84B31]' : 'text-[#2B1E1A]'
            }`}
          >
            {formatPercent(plan.laborOverloadPct, usePersianDigits, 0)}
          </div>
          <div className="text-[11px] text-[#7D6C63] mt-1 tabular-nums">
            {formatNumber(plan.totalLaborHoursNeeded, { decimals: 1, usePersian: usePersianDigits })} از{' '}
            {formatNumber(plan.availableLaborHours, { usePersian: usePersianDigits })} نفر-ساعت
          </div>
        </div>

        <div className="bg-white border border-[#EAE2D8] rounded-xl p-4">
          <div className="text-xs font-bold text-[#4B3B34]">نقدینگی خرید کسری انبار</div>
          <div className="mt-2 text-xl font-extrabold text-[#D97706] tabular-nums">
            {fmt(plan.totalNetCashNeeded, true)}
          </div>
          <div className="text-[11px] text-[#7D6C63] mt-1 tabular-nums">
            ارزش کل مواد مصرفی: {fmt(plan.totalFullCashCost, true)}
          </div>
        </div>

        <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
          <div className="text-xs font-bold text-[#065F46]">سود خالص پیش‌بینی‌شده</div>
          <div className="mt-2 text-xl font-extrabold text-[#1B4332] tabular-nums">
            <PrivacyValue>{fmt(plan.projectedNetProfit, true)}</PrivacyValue>
          </div>
          <div className="text-[11px] text-[#2D6A4F] mt-1 tabular-nums">
            برای مجموع {formatNumber(plan.totalTargetKg, { usePersian: usePersianDigits })} کیلو شیرینی
          </div>
        </div>
      </div>

      {/* Consolidated Shopping List */}
      <section className="bg-white border border-[#EAE2D8] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4 text-[#2D6A4F]" />
            <span>لیست خرید تجمیعی بازار ({occasionName})</span>
          </h3>
          <button
            type="button"
            onClick={handleExportShoppingCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2B1E1A] text-white text-xs font-bold hover:bg-[#3E2D27] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی اکسل لیست خرید (CSV)</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EAE2D8] text-[#6E5C54]">
                <th className="py-2.5 px-3 font-bold">ماده اولیه</th>
                <th className="py-2.5 px-3 font-bold">نیاز کل تولید</th>
                <th className="py-2.5 px-3 font-bold">موجودی فعلی انبار</th>
                <th className="py-2.5 px-3 font-bold">تعداد بسته خریدنی</th>
                <th className="py-2.5 px-3 font-bold">بودجه خرید کسری</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3ECE4]">
              {plan.shoppingList.map((item) => {
                const isGram = item.baseUnit === 'gram';
                return (
                  <tr key={item.ingredientId} className="hover:bg-[#FAF8F5]">
                    <td className="py-2.5 px-3 font-bold text-[#2B1E1A]">
                      {item.name}
                      <span className="text-[11px] font-normal text-[#7D6C63] mr-1.5">
                        ({item.packLabel})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 tabular-nums text-[#4B3B34]">
                      {isGram
                        ? `${formatNumber(item.requiredBase / 1000, { decimals: 2, usePersian: usePersianDigits })} کیلو`
                        : `${formatNumber(Math.ceil(item.requiredBase), { usePersian: usePersianDigits })} عدد`}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums text-[#6E5C54]">
                      {isGram
                        ? `${formatNumber(item.inStockBase / 1000, { decimals: 2, usePersian: usePersianDigits })} کیلو`
                        : `${formatNumber(item.inStockBase, { usePersian: usePersianDigits })} عدد`}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums font-extrabold">
                      {item.packsToBuy > 0 ? (
                        <span className="text-[#C84B31]">
                          {formatDigits(item.packsToBuy, usePersianDigits)} بسته ({item.packLabel})
                        </span>
                      ) : (
                        <span className="text-[#2D6A4F]">موجودی کافی است</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums font-bold text-[#2B1E1A]">
                      {item.netCashNeeded > 0 ? fmt(item.netCashNeeded) : '۰ تومان'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
