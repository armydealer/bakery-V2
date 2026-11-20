import React, { useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Play, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { useWorkshop } from '../../store/WorkshopContext';
import {
  formatCurrency,
  formatDigits,
  formatNumber,
  formatPercent,
  formatShortToman,
} from '../../utils/formatters';
import { HelpTip } from '../../components/HelpTip';
import { PrivacyValue } from '../../components/PrivacyValue';

export const ScientificLabView: React.FC = () => {
  const {
    data,
    forecast,
    forecastAssumptions,
    setForecastAssumptions,
    monteCarloConfig,
    setMonteCarloConfig,
    monteCarlo,
    rerunMonteCarlo,
    tornado,
  } = useWorkshop();

  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number, compact = true) =>
    formatCurrency(v, currencyUnit, usePersianDigits, compact);

  const [forecastMetric, setForecastMetric] = useState<'profit' | 'revenue'>('profit');

  // Prepare Area-Range chart data (Recharts Area range via [low, high] array)
  const forecastChartData = forecast.map((pt) => ({
    month: pt.shamsiName,
    occasion: pt.occasion,
    base: forecastMetric === 'profit' ? pt.profitBase : pt.revenueBase,
    realProfit: pt.realProfitBase,
    totalCost: pt.totalCostBase,
    confidenceBand:
      forecastMetric === 'profit'
        ? [pt.profitP10, pt.profitP90]
        : [pt.revenueP10, pt.revenueP90],
    p10: forecastMetric === 'profit' ? pt.profitP10 : pt.revenueP10,
    p90: forecastMetric === 'profit' ? pt.profitP90 : pt.revenueP90,
  }));

  // Tornado horizontal diverging bars with clean concise axis labels
  const tornadoChartData = tornado.map((d) => ({
    label: d.label.replace(' (±۱۰٪)', ''),
    fullLabel: d.label,
    negative: Math.min(d.lowProfitDelta, d.highProfitDelta),
    positive: Math.max(d.lowProfitDelta, d.highProfitDelta),
    spread: d.totalSpread,
    desc: d.impactDescription,
  }));

  return (
    <div className="space-y-6">
      {/* 1. 12-Month Holt-Winters Seasonal Forecast with 90% Confidence Cone */}
      <section className="bg-white border border-[#EAE2D8] rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
              <TrendingUp className="w-4.5 h-4.5 text-[#4338CA]" />
              <span>۱. پیش‌بینی سری زمانی فصلی ایران با باند اطمینان ۹۰٪</span>
              <HelpTip id="seasonalForecast" />
            </h2>
            <p className="text-xs text-[#7D6C63] mt-0.5">
              محاسبه ۱۰۰٪ قطعی بر اساس تقویم فصلی شمسی، رشد تقاضا و شکاف انتقال تورم مواد به قیمت فروش
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric switcher */}
            <div className="inline-flex rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setForecastMetric('profit')}
                className={`px-3 py-1.5 rounded-md font-bold cursor-pointer transition-colors ${
                  forecastMetric === 'profit'
                    ? 'bg-[#4338CA] text-white'
                    : 'text-[#5A4A42] hover:text-[#2B1E1A]'
                }`}
              >
                سود ماهانه
              </button>
              <button
                type="button"
                onClick={() => setForecastMetric('revenue')}
                className={`px-3 py-1.5 rounded-md font-bold cursor-pointer transition-colors ${
                  forecastMetric === 'revenue'
                    ? 'bg-[#4338CA] text-white'
                    : 'text-[#5A4A42] hover:text-[#2B1E1A]'
                }`}
              >
                درآمد و هزینه
              </button>
            </div>

            {/* Horizon switcher */}
            <div className="inline-flex rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] p-0.5 text-xs">
              {([3, 6, 12] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setForecastAssumptions((p) => ({ ...p, horizonMonths: h }))}
                  className={`px-2.5 py-1.5 rounded-md font-bold cursor-pointer transition-colors ${
                    forecastAssumptions.horizonMonths === h
                      ? 'bg-[#2B1E1A] text-white'
                      : 'text-[#5A4A42] hover:text-[#2B1E1A]'
                  }`}
                >
                  {formatDigits(h, usePersianDigits)} ماهه
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Assumption Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EFE7DC]">
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-[#4B3B34]">تورم سالانه مواد اولیه</span>
              <span className="text-[#4338CA] font-bold tabular-nums">
                {formatPercent(forecastAssumptions.annualMaterialInflationPct, usePersianDigits, 0)}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={85}
              step={2}
              value={forecastAssumptions.annualMaterialInflationPct}
              onChange={(e) =>
                setForecastAssumptions((p) => ({
                  ...p,
                  annualMaterialInflationPct: Number(e.target.value),
                }))
              }
              className="w-full accent-[#4338CA]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-[#4B3B34]">رشد ماهانه حجم فروش</span>
              <span className="text-[#2D6A4F] font-bold tabular-nums">
                {formatPercent(forecastAssumptions.monthlyDemandGrowthPct, usePersianDigits, 1)}
              </span>
            </div>
            <input
              type="range"
              min={-3}
              max={6}
              step={0.5}
              value={forecastAssumptions.monthlyDemandGrowthPct}
              onChange={(e) =>
                setForecastAssumptions((p) => ({
                  ...p,
                  monthlyDemandGrowthPct: Number(e.target.value),
                }))
              }
              className="w-full accent-[#2D6A4F]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-[#4B3B34]">ضریب انتقال تورم به قیمت منو</span>
              <span className="text-[#D97706] font-bold tabular-nums">
                {formatPercent(forecastAssumptions.pricePassThroughPct, usePersianDigits, 0)}
              </span>
            </div>
            <input
              type="range"
              min={40}
              max={105}
              step={5}
              value={forecastAssumptions.pricePassThroughPct}
              onChange={(e) =>
                setForecastAssumptions((p) => ({
                  ...p,
                  pricePassThroughPct: Number(e.target.value),
                }))
              }
              className="w-full accent-[#D97706]"
            />
          </div>
        </div>

        {/* Confidence Cone Chart */}
        <div className="h-[310px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecastChartData} margin={{ top: 12, right: 16, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DE" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4B3B34' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#5A4A42' }}
                tickFormatter={(v) => formatShortToman(Number(v), usePersianDigits)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0].payload as (typeof forecastChartData)[number];
                  return (
                    <div
                      dir="rtl"
                      className="bg-white border border-[#EAE2D8] rounded-xl shadow-lg p-3 text-xs space-y-1"
                    >
                      <div className="font-extrabold text-[#2B1E1A]">
                        {pt.month} — {pt.occasion}
                      </div>
                      <div className="text-[#4338CA] font-bold tabular-nums">
                        مسیر محتمل (Base): {data.settings.privacyMode ? '•••••' : fmt(pt.base, false)}
                      </div>
                      <div className="text-[#2D6A4F] tabular-nums">
                        باند خوش‌بینانه (P90): {data.settings.privacyMode ? '•••••' : fmt(pt.p90, false)}
                      </div>
                      <div className="text-[#C84B31] tabular-nums">
                        باند بدبینانه (P10): {data.settings.privacyMode ? '•••••' : fmt(pt.p10, false)}
                      </div>
                      {forecastMetric === 'profit' && (
                        <div className="text-[#065F46] font-semibold tabular-nums pt-1 border-t border-[#F0E8DE]">
                          سود واقعی قابل برداشت: {data.settings.privacyMode ? '•••••' : fmt(pt.realProfit, false)}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <ReferenceLine y={0} stroke="#C84B31" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="confidenceBand"
                fill="#4338CA"
                fillOpacity={0.14}
                stroke="none"
                name="باند اطمینان ۹۰٪"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="base"
                stroke="#4338CA"
                strokeWidth={2.8}
                dot={{ r: 4, fill: '#4338CA' }}
                name="مسیر محتمل"
                isAnimationActive={false}
              />
              {forecastMetric === 'profit' ? (
                <Line
                  type="monotone"
                  dataKey="realProfit"
                  stroke="#2D6A4F"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  name="سود واقعی"
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  type="monotone"
                  dataKey="totalCost"
                  stroke="#C84B31"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  name="هزینه کل"
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 2. Monte Carlo 1,000-Iteration Risk Simulator + 3. Tornado Sensitivity Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Monte Carlo Engine */}
        <section className="xl:col-span-7 bg-white border border-[#EAE2D8] rounded-xl p-5 flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
                <Activity className="w-4.5 h-4.5 text-[#4338CA]" />
                <span>۲. شبیه‌ساز علمی مونت‌کارلو ({formatNumber(monteCarlo.iterations, { usePersian: usePersianDigits })} سناریو)</span>
                <HelpTip id="monteCarlo" />
              </h2>
              <p className="text-xs text-[#7D6C63] mt-0.5 tabular-nums">
                اجرای محلی در {formatDigits(monteCarlo.durationMs, usePersianDigits)} میلی‌ثانیه بدون AI · توزیع گاوسی همبسته
              </p>
            </div>

            <button
              type="button"
              onClick={rerunMonteCarlo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#4338CA] text-white text-xs font-bold hover:bg-[#3730A3] transition-colors cursor-pointer shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>اجرای {formatNumber(monteCarloConfig.iterations, { usePersian: usePersianDigits })} سناریوی بازار</span>
            </button>
          </div>

          {/* Uncertainty Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-3 rounded-xl bg-[#EEF2FF]/60 border border-[#C7D2FE]">
            <div>
              <div className="flex justify-between text-[11px] font-bold text-[#312E81] mb-1">
                <span>نوسان فروش ماهانه</span>
                <span className="tabular-nums">±{formatDigits(monteCarloConfig.demandVolatilityPct, usePersianDigits)}٪</span>
              </div>
              <input
                type="range"
                min={4}
                max={35}
                step={1}
                value={monteCarloConfig.demandVolatilityPct}
                onChange={(e) =>
                  setMonteCarloConfig((p) => ({ ...p, demandVolatilityPct: Number(e.target.value) }))
                }
                className="w-full accent-[#4338CA]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold text-[#312E81] mb-1">
                <span>نوسان قیمت مواد اولیه</span>
                <span className="tabular-nums">±{formatDigits(monteCarloConfig.costVolatilityPct, usePersianDigits)}٪</span>
              </div>
              <input
                type="range"
                min={3}
                max={30}
                step={1}
                value={monteCarloConfig.costVolatilityPct}
                onChange={(e) =>
                  setMonteCarloConfig((p) => ({ ...p, costVolatilityPct: Number(e.target.value) }))
                }
                className="w-full accent-[#4338CA]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-bold text-[#312E81] mb-1">
                <span>نوسان ضایعات ویترین</span>
                <span className="tabular-nums">±{formatDigits(monteCarloConfig.spoilageVolatilityPct, usePersianDigits)}٪</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={monteCarloConfig.spoilageVolatilityPct}
                onChange={(e) =>
                  setMonteCarloConfig((p) => ({ ...p, spoilageVolatilityPct: Number(e.target.value) }))
                }
                className="w-full accent-[#4338CA]"
              />
            </div>
          </div>

          {/* 4 Plain-Persian Quantitative Risk Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            <div className="rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] p-3">
              <div className="text-[11px] text-[#065F46] font-semibold">احتمال سوددهی</div>
              <div className="text-lg font-extrabold text-[#1B4332] tabular-nums mt-0.5">
                {formatPercent(monteCarlo.probabilityOfProfitPct, usePersianDigits)}
              </div>
            </div>
            <div className="rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] p-3">
              <div className="text-[11px] text-[#6E5C54] font-semibold">میانه سود (P50)</div>
              <div className="text-sm font-extrabold text-[#2B1E1A] tabular-nums mt-1">
                <PrivacyValue>{fmt(monteCarlo.medianProfit, true)}</PrivacyValue>
              </div>
            </div>
            <div className="rounded-lg bg-[#FFFBEB] border border-[#F5D08A] p-3">
              <div className="text-[11px] text-[#92400E] font-semibold">بدترین ۵٪ (VaR 95%)</div>
              <div className="text-sm font-extrabold text-[#B45309] tabular-nums mt-1">
                <PrivacyValue>{fmt(monteCarlo.profitAtRisk95, true)}</PrivacyValue>
              </div>
            </div>
            <div
              className={`rounded-lg border p-3 ${
                monteCarlo.checkDefaultRiskPct > 10
                  ? 'bg-[#FEF2F2] border-[#F5C2B8]'
                  : 'bg-[#EEF2FF] border-[#C7D2FE]'
              }`}
            >
              <div className="text-[11px] text-[#312E81] font-semibold">ریسک کسری چک</div>
              <div
                className={`text-lg font-extrabold tabular-nums mt-0.5 ${
                  monteCarlo.checkDefaultRiskPct > 10 ? 'text-[#C84B31]' : 'text-[#4338CA]'
                }`}
              >
                {formatPercent(monteCarlo.checkDefaultRiskPct, usePersianDigits)}
              </div>
            </div>
          </div>

          {/* Probability Distribution Histogram */}
          <div className="h-[235px] w-full flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monteCarlo.histogram} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DE" vertical={false} />
                <XAxis dataKey="binLabel" tick={{ fontSize: 10, fill: '#5A4A42' }} />
                <YAxis tick={{ fontSize: 10, fill: '#5A4A42' }} />
                <Tooltip
                  formatter={(v: unknown) => [
                    `${formatNumber(Number(v), { usePersian: usePersianDigits })} سناریو`,
                    'تکرار در شبیه‌سازی',
                  ]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #EAE2D8', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {monteCarlo.histogram.map((bin, idx) => (
                    <Cell key={idx} fill={bin.isLoss ? '#C84B31' : '#4338CA'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 3. Tornado Sensitivity Chart */}
        <section className="xl:col-span-5 bg-white border border-[#EAE2D8] rounded-xl p-5 flex flex-col">
          <div className="mb-3">
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
              <SlidersHorizontal className="w-4.5 h-4.5 text-[#D97706]" />
              <span>۳. نمودار تورنادو تحلیل حساسیت (±۱۰٪)</span>
              <HelpTip id="tornadoChart" />
            </h2>
            <p className="text-xs text-[#7D6C63] mt-0.5">
              کدام متغیر اگر ۱۰٪ تکان بخورد، بیشترین ضربه یا جهش را به سود ماهانه می‌زند؟
            </p>
          </div>

          <div className="h-[310px] w-full flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tornadoChartData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                barGap={-18}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DE" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#5A4A42' }}
                  tickFormatter={(v) => formatShortToman(Number(v), usePersianDigits)}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={155}
                  tick={{ fontSize: 11, fill: '#2B1E1A' }}
                />
                <ReferenceLine x={0} stroke="#2B1E1A" strokeWidth={1.2} />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [
                    data.settings.privacyMode ? '•••••' : fmt(Number(v), false),
                    name === 'positive' ? 'اثر تغییر مطلوب (+۱۰٪)' : 'اثر تغییر نامطلوب (-۱۰٪)',
                  ]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #EAE2D8', fontSize: '12px' }}
                />
                <Bar dataKey="negative" fill="#C84B31" radius={[4, 0, 0, 4]} barSize={18} isAnimationActive={false} />
                <Bar dataKey="positive" fill="#2D6A4F" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-[#F2EBE2] text-xs text-[#4B3B34] space-y-1">
            {tornado.slice(0, 2).map((drv, i) => (
              <div key={drv.key} className="flex items-center justify-between">
                <span className="font-bold">
                  {formatDigits(i + 1, usePersianDigits)}. {drv.label}
                </span>
                <span className="tabular-nums font-semibold text-[#C84B31]">
                  دامنه اثر: <PrivacyValue>{fmt(drv.totalSpread, true)}</PrivacyValue>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
