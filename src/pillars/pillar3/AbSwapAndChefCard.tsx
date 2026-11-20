import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Printer } from 'lucide-react';
import { useWorkshop } from '../../store/WorkshopContext';
import { computeWorkshopSummary } from '../../utils/costEngine';
import { formatCurrency, formatDigits, formatNumber, formatPercent, safeDiv } from '../../utils/formatters';
import { HelpTip } from '../../components/HelpTip';
import { LocaleNumberInput } from '../../components/LocaleNumberInput';
import { PrivacyValue } from '../../components/PrivacyValue';

export const AbSwapLab: React.FC = () => {
  const { data, summary } = useWorkshop();
  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number) => formatCurrency(v, currencyUnit, usePersianDigits, false);

  const [recipeId, setRecipeId] = useState(data.recipes[0]?.id ?? '');
  const selectedRecipe = data.recipes.find((r) => r.id === recipeId) ?? data.recipes[0];

  const [sourceIngId, setSourceIngId] = useState(() => {
    const line = selectedRecipe?.items.find((i) => i.kind === 'ingredient');
    return line?.refId ?? data.ingredients[1]?.id ?? '';
  });
  const [targetIngId, setTargetIngId] = useState(data.ingredients[2]?.id ?? data.ingredients[0]?.id ?? '');
  const [swapPct, setSwapPct] = useState(25);

  const simulation = useMemo(() => {
    if (!selectedRecipe) return null;
    const baseMetric = summary.recipeMetrics.find((m) => m.recipeId === selectedRecipe.id);
    if (!baseMetric) return null;

    const line = selectedRecipe.items.find(
      (i) => i.kind === 'ingredient' && i.refId === sourceIngId
    );
    if (!line) return { missingLine: true as const };

    const swappedAmt = line.amount * (swapPct / 100);
    const remainingAmt = line.amount - swappedAmt;

    const nextItems = selectedRecipe.items.map((item) =>
      item.id === line.id ? { ...item, amount: remainingAmt } : item
    );
    if (swappedAmt > 0 && targetIngId) {
      nextItems.push({
        id: 'ab-swap-injected',
        kind: 'ingredient',
        refId: targetIngId,
        amount: swappedAmt,
      });
    }

    const simulatedData = {
      ...data,
      recipes: data.recipes.map((r) =>
        r.id === selectedRecipe.id ? { ...r, items: nextItems } : r
      ),
    };
    const nextSummary = computeWorkshopSummary(simulatedData);
    const nextMetric = nextSummary.recipeMetrics.find((m) => m.recipeId === selectedRecipe.id);
    if (!nextMetric) return null;

    const costDeltaPerKg = baseMetric.totalCostPerKg - nextMetric.totalCostPerKg;
    const monthlySavings = costDeltaPerKg * selectedRecipe.monthlySalesKg;

    return {
      missingLine: false as const,
      baseCost: baseMetric.totalCostPerKg,
      newCost: nextMetric.totalCostPerKg,
      baseMargin: baseMetric.netMarginPct,
      newMargin: nextMetric.netMarginPct,
      costDeltaPerKg,
      monthlySavings,
    };
  }, [selectedRecipe, sourceIngId, targetIngId, swapPct, data, summary]);

  if (!selectedRecipe) {
    return (
      <div className="bg-white border border-[#EAE2D8] rounded-xl p-6 text-center text-xs text-[#7D6C63]">
        ابتدا حداقل یک محصول در تب فرمولاسیون تعریف کنید.
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-5">
      <div>
        <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
          <ArrowLeftRight className="w-4.5 h-4.5 text-[#4338CA]" />
          <span>آزمایشگاه مقایسه A/B فرمولاسیون (بدون دست‌کاری دستور اصلی)</span>
          <HelpTip id="abSwapLab" />
        </h2>
        <p className="text-xs text-[#7D6C63] mt-0.5">
          اثر جایگزینی درصدی از یک ماده (مثلاً ترکیب کره حیوانی و روغن صاف یا تعدیل مغزیجات) را روی سود ماهانه بسنجید.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-bold text-[#4B3B34] mb-1">انتخاب شیرینی</label>
          <select
            value={selectedRecipe.id}
            onChange={(e) => {
              const nextRec = data.recipes.find((r) => r.id === e.target.value);
              setRecipeId(e.target.value);
              const firstLine = nextRec?.items.find((i) => i.kind === 'ingredient');
              if (firstLine) setSourceIngId(firstLine.refId);
            }}
            className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-semibold"
          >
            {data.recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#4B3B34] mb-1">ماده فعلی داخل فرمول (A)</label>
          <select
            value={sourceIngId}
            onChange={(e) => setSourceIngId(e.target.value)}
            className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-semibold"
          >
            {selectedRecipe.items
              .filter((i) => i.kind === 'ingredient')
              .map((line) => {
                const ing = data.ingredients.find((x) => x.id === line.refId);
                return (
                  <option key={line.id} value={line.refId}>
                    {ing?.name ?? line.refId}
                  </option>
                );
              })}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#4B3B34] mb-1">ماده جایگزین پیشنهادی (B)</label>
          <select
            value={targetIngId}
            onChange={(e) => setTargetIngId(e.target.value)}
            className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-semibold"
          >
            {data.ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between text-xs font-bold text-[#4B3B34] mb-1">
            <span>درصد جایگزینی</span>
            <span className="text-[#4338CA] tabular-nums">{formatDigits(swapPct, usePersianDigits)}٪</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={swapPct}
            onChange={(e) => setSwapPct(Number(e.target.value))}
            className="w-full accent-[#4338CA] mt-2"
          />
        </div>
      </div>

      {simulation && !simulation.missingLine && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-4">
            <div className="text-xs font-bold text-[#6E5C54]">فرمول فعلی (نسخه A)</div>
            <div className="mt-2 text-lg font-extrabold text-[#2B1E1A] tabular-nums">
              <PrivacyValue>{fmt(simulation.baseCost)}</PrivacyValue> / کیلو
            </div>
            <div className="text-xs text-[#7D6C63] mt-1 tabular-nums">
              حاشیه سود: <PrivacyValue>{formatPercent(simulation.baseMargin, usePersianDigits)}</PrivacyValue>
            </div>
          </div>

          <div className="rounded-xl border border-[#C7D2FE] bg-[#EEF2FF]/60 p-4">
            <div className="text-xs font-bold text-[#312E81]">فرمول شبیه‌سازی‌شده (نسخه B)</div>
            <div className="mt-2 text-lg font-extrabold text-[#4338CA] tabular-nums">
              <PrivacyValue>{fmt(simulation.newCost)}</PrivacyValue> / کیلو
            </div>
            <div className="text-xs text-[#312E81] mt-1 tabular-nums">
              حاشیه سود جدید: <PrivacyValue>{formatPercent(simulation.newMargin, usePersianDigits)}</PrivacyValue>
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              simulation.monthlySavings >= 0
                ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                : 'bg-[#FEF2F2] border-[#F5C2B8]'
            }`}
          >
            <div className="text-xs font-bold text-[#2B1E1A]">صرفه‌جویی / تغییر سود ماهانه</div>
            <div
              className={`mt-2 text-lg font-extrabold tabular-nums ${
                simulation.monthlySavings >= 0 ? 'text-[#2D6A4F]' : 'text-[#C84B31]'
              }`}
            >
              <PrivacyValue>
                {simulation.monthlySavings >= 0 ? '+' : ''}
                {formatCurrency(simulation.monthlySavings, currencyUnit, usePersianDigits, true)}
              </PrivacyValue>
            </div>
            <div className="text-xs text-[#4B3B34] mt-1 tabular-nums">
              تغییر هر کیلو: <PrivacyValue>{fmt(simulation.costDeltaPerKg)}</PrivacyValue>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const PrintableChefCard: React.FC = () => {
  const { data, summary } = useWorkshop();
  const usePersian = data.settings.usePersianDigits;
  const [recipeId, setRecipeId] = useState(data.recipes[0]?.id ?? '');
  const [targetKg, setTargetKg] = useState<number>(25);

  const recipe = data.recipes.find((r) => r.id === recipeId) ?? data.recipes[0];
  const metric = summary.recipeMetrics.find((m) => m.recipeId === recipe?.id);

  if (!recipe || !metric) {
    return (
      <div className="bg-white border border-[#EAE2D8] rounded-xl p-6 text-center text-xs text-[#7D6C63]">
        محصولی برای صدور کارت پخت موجود نیست.
      </div>
    );
  }

  const scaleFactor = safeDiv(Math.max(0.5, targetKg), Math.max(0.1, metric.netYieldKg), 1);

  return (
    <div className="space-y-4">
      {/* Controls (Hidden on Print) */}
      <div className="no-print bg-white border border-[#EAE2D8] rounded-xl p-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold text-[#4B3B34] mb-1">
              انتخاب محصول برای کارت پخت <HelpTip id="chefCard" />
            </label>
            <select
              value={recipe.id}
              onChange={(e) => setRecipeId(e.target.value)}
              className="rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-bold min-w-[200px]"
            >
              {data.recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-40">
            <label className="block text-xs font-bold text-[#4B3B34] mb-1">
              وزن هدف خالص تولید (کیلوگرم)
            </label>
            <LocaleNumberInput value={targetKg} onChange={setTargetKg} min={1} suffix="کیلو" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2B1E1A] text-white text-xs font-bold hover:bg-[#3E2D27] cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>چاپ کارت پخت بدون قیمت (ویژه استادکار)</span>
        </button>
      </div>

      {/* Zero-Price Printable Chef Card */}
      <article className="print-container bg-white border-2 border-[#2B1E1A] rounded-2xl p-6 max-w-3xl mx-auto">
        <div className="flex items-start justify-between border-b-2 border-[#2B1E1A] pb-4 mb-4">
          <div>
            <div className="text-xs font-bold text-[#7D6C63]">{data.settings.workshopName}</div>
            <h2 className="text-xl font-extrabold text-[#2B1E1A] mt-0.5">
              کارت استاندارد پخت کارگاه: {recipe.name}
            </h2>
            <div className="text-xs text-[#2D6A4F] font-bold mt-1">
              نسخه کارگاهی — فاقد هرگونه اطلاعات قیمت و سود (محرمانگی کامل)
            </div>
          </div>
          <div className="text-left bg-[#FAF8F5] border border-[#EAE2D8] rounded-xl px-4 py-2.5 tabular-nums">
            <div className="text-[11px] text-[#6E5C54]">وزن هدف خالص</div>
            <div className="text-xl font-extrabold text-[#2B1E1A]">
              {formatNumber(targetKg, { decimals: 1, usePersian })} کیلوگرم
            </div>
          </div>
        </div>

        {/* Technical Specs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-xs">
          <div className="rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] p-2.5 tabular-nums">
            <div className="text-[#7D6C63]">دمای استاندارد فر</div>
            <div className="font-extrabold text-sm text-[#2B1E1A] mt-0.5">
              {formatDigits(recipe.ovenTempCelsius, usePersian)} درجه سانتی‌گراد
            </div>
          </div>
          <div className="rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] p-2.5 tabular-nums">
            <div className="text-[#7D6C63]">زمان هر نوبت فر</div>
            <div className="font-extrabold text-sm text-[#2B1E1A] mt-0.5">
              {formatDigits(recipe.ovenMinutesPerBatch, usePersian)} دقیقه
            </div>
          </div>
          <div className="rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] p-2.5 tabular-nums">
            <div className="text-[#7D6C63]">تعداد پخت معادل</div>
            <div className="font-extrabold text-sm text-[#2B1E1A] mt-0.5">
              {formatNumber(scaleFactor, { decimals: 2, usePersian })} بچ
            </div>
          </div>
          <div className="rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] p-2.5 tabular-nums">
            <div className="text-[#7D6C63]">تعداد سینی تقریبی</div>
            <div className="font-extrabold text-sm text-[#2B1E1A] mt-0.5">
              {formatNumber(Math.ceil(recipe.ovenTraysPerBatch * scaleFactor), { usePersian })} سینی
            </div>
          </div>
        </div>

        {/* Exact Scaled Ingredients Table (Zero Prices) */}
        <table className="w-full text-right text-sm border-collapse mb-5">
          <thead>
            <tr className="border-b-2 border-[#2B1E1A] text-[#2B1E1A]">
              <th className="py-2 px-3 font-extrabold">ردیف</th>
              <th className="py-2 px-3 font-extrabold">نام ماده / نیمه‌ساخته</th>
              <th className="py-2 px-3 font-extrabold">مقدار دقیق توزین</th>
              <th className="py-2 px-3 font-extrabold">تیک کنترل استادکار</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAE2D8]">
            {recipe.items.map((line, idx) => {
              const ing =
                line.kind === 'ingredient'
                  ? data.ingredients.find((i) => i.id === line.refId)
                  : null;
              const sr =
                line.kind === 'subRecipe'
                  ? data.subRecipes.find((s) => s.id === line.refId)
                  : null;
              const scaledAmt = line.amount * scaleFactor;
              const unitText =
                line.kind === 'subRecipe'
                  ? 'گرم'
                  : ing?.baseUnit === 'piece'
                  ? 'عدد'
                  : ing?.baseUnit === 'ml'
                  ? 'میلی‌لیتر'
                  : 'گرم';

              return (
                <tr key={line.id}>
                  <td className="py-2.5 px-3 tabular-nums text-[#7D6C63]">
                    {formatDigits(idx + 1, usePersian)}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-[#2B1E1A]">
                    {ing?.name ?? sr?.name ?? line.refId}
                  </td>
                  <td className="py-2.5 px-3 font-extrabold text-[#2B1E1A] tabular-nums">
                    {unitText === 'گرم' && scaledAmt >= 1000
                      ? `${formatNumber(scaledAmt / 1000, { decimals: 2, usePersian })} کیلوگرم (${formatNumber(
                          Math.round(scaledAmt),
                          { usePersian }
                        )} گرم)`
                      : `${formatNumber(scaledAmt, {
                          decimals: unitText === 'عدد' ? 0 : 1,
                          usePersian,
                        })} ${unitText}`}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block w-5 h-5 border-2 border-[#8C7B72] rounded" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {recipe.chefInstructions && (
          <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE2D8] p-4 text-xs text-[#2B1E1A] leading-relaxed">
            <div className="font-extrabold mb-1">دستورالعمل فنی پخت و کنترل کیفیت:</div>
            <p>{recipe.chefInstructions}</p>
          </div>
        )}
      </article>
    </div>
  );
};
