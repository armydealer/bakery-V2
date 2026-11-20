import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useWorkshop } from '../../store/WorkshopContext';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShortToman,
} from '../../utils/formatters';
import { HelpTip } from '../../components/HelpTip';
import { PrivacyValue } from '../../components/PrivacyValue';
import { MenuQuadrant } from '../../types';

const QUADRANT_META: Record<MenuQuadrant, { label: string; color: string; advice: string }> = {
  star: {
    label: 'ستاره ویترین',
    color: '#2D6A4F',
    advice: 'جایگاه طلایی ویترین، کیفیت ثابت، افزایش تبلیغات',
  },
  plowhorse: {
    label: 'اسب کاری',
    color: '#D97706',
    advice: 'پرفروش ولی کم‌سود؛ اصلاح جزئی نرخ یا ترکیب در پک میکس',
  },
  puzzle: {
    label: 'جوهر پنهان',
    color: '#4338CA',
    advice: 'سود عالی ولی فروش کم؛ تست رایگان و معرفی در اینستاگرام',
  },
  dog: {
    label: 'تله سود',
    color: '#C84B31',
    advice: 'بازنگری جدی فرمول، حذف یا تولید فقط به‌صورت سفارشی',
  },
};

export const CommercialCockpitView: React.FC = () => {
  const { data, summary } = useWorkshop();
  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number) => formatCurrency(v, currencyUnit, usePersianDigits, false);

  const avgKg =
    summary.recipeMetrics.reduce((s, r) => s + r.monthlySalesKg, 0) /
    Math.max(1, summary.recipeMetrics.length);
  const avgProfitKg =
    summary.recipeMetrics.reduce((s, r) => s + r.netProfitPerKg, 0) /
    Math.max(1, summary.recipeMetrics.length);

  const scatterData = summary.recipeMetrics.map((r) => ({
    name: r.name,
    kg: r.monthlySalesKg,
    profitPerKg: Math.round(r.netProfitPerKg),
    monthlyProfit: Math.max(1_000_000, Math.round(r.monthlyNetProfit)),
    marginPct: r.netMarginPct,
    quadrant: r.quadrant,
    fill: QUADRANT_META[r.quadrant].color,
  }));

  const channelChartData = summary.channelSummary.map((c) => ({
    name: c.label,
    marginPct: Number(c.marginPct.toFixed(1)),
    kg: Math.round(c.kg),
    netProfit: Math.round(c.netProfit),
    fill:
      c.marginPct >= data.settings.targetNetMarginPct
        ? '#2D6A4F'
        : c.marginPct >= data.settings.redFlagMarginPct
        ? '#D97706'
        : '#C84B31',
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Menu Engineering 4-Quadrant Scatter Matrix */}
        <section className="xl:col-span-7 bg-white border border-[#EAE2D8] rounded-xl p-5 flex flex-col">
          <div className="mb-3">
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
              ماتریس مهندسی منو (۴ ربع محبوبیت و سودآوری)
              <HelpTip id="menuMatrix" />
            </h2>
            <p className="text-xs text-[#7D6C63] mt-0.5">
              محور افقی: فروش ماهانه (کیلو) · محور عمودی: سود خالص هر کیلو (تومان)
            </p>
          </div>

          <div className="h-[310px] w-full flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 20, left: 12, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DE" />
                <XAxis
                  type="number"
                  dataKey="kg"
                  name="فروش ماهانه"
                  unit=" کیلو"
                  tick={{ fontSize: 11, fill: '#5A4A42' }}
                />
                <YAxis
                  type="number"
                  dataKey="profitPerKg"
                  name="سود هر کیلو"
                  tick={{ fontSize: 11, fill: '#5A4A42' }}
                  tickFormatter={(v) => formatShortToman(Number(v), usePersianDigits)}
                />
                <ZAxis type="number" dataKey="monthlyProfit" range={[90, 420]} />
                <ReferenceLine x={avgKg} stroke="#B8A898" strokeDasharray="4 4" />
                <ReferenceLine y={avgProfitKg} stroke="#B8A898" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof scatterData)[number];
                    return (
                      <div
                        dir="rtl"
                        className="bg-white border border-[#EAE2D8] rounded-xl shadow-lg p-3 text-xs space-y-1"
                      >
                        <div className="font-extrabold text-[#2B1E1A]">{p.name}</div>
                        <div className="font-semibold" style={{ color: p.fill }}>
                          دسته: {QUADRANT_META[p.quadrant].label}
                        </div>
                        <div className="tabular-nums text-[#4B3B34]">
                          فروش ماهانه: {formatNumber(p.kg, { usePersian: usePersianDigits })} کیلو
                        </div>
                        <div className="tabular-nums text-[#4B3B34]">
                          سود هر کیلو: {data.settings.privacyMode ? '•••••' : fmt(p.profitPerKg)} (
                          {formatPercent(p.marginPct, usePersianDigits)})
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} fillOpacity={0.85} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-[#F2EBE2] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {(Object.keys(QUADRANT_META) as MenuQuadrant[]).map((q) => {
              const items = summary.recipeMetrics.filter((r) => r.quadrant === q);
              return (
                <div key={q} className="bg-[#FAF8F5] rounded-lg p-2 border border-[#F0E8DE]">
                  <div className="font-bold" style={{ color: QUADRANT_META[q].color }}>
                    {QUADRANT_META[q].label} ({formatNumber(items.length, { usePersian: usePersianDigits })})
                  </div>
                  <div className="text-[#5A4A42] truncate mt-0.5">
                    {items.map((i) => i.name).join('، ') || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Channel Profitability Comparison */}
        <section className="xl:col-span-5 bg-white border border-[#EAE2D8] rounded-xl p-5 flex flex-col">
          <div className="mb-3">
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
              مقایسه حاشیه سود کانال‌های فروش ایران
              <HelpTip id="channelProfit" />
            </h2>
            <p className="text-xs text-[#7D6C63] mt-0.5">
              پس از کسر تخفیف کافه، کمیسیون اسنپ‌فود ({formatPercent(data.settings.defaultSnappfoodCommissionPct, usePersianDigits, 0)}) و جعبه پیک
            </p>
          </div>

          <div className="h-[260px] w-full flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={channelChartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DE" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#5A4A42' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={118}
                  tick={{ fontSize: 11, fill: '#2B1E1A' }}
                />
                <Tooltip
                  formatter={(v: unknown) => [
                    data.settings.privacyMode ? '•••' : `${v}٪`,
                    'حاشیه سود خالص',
                  ]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #EAE2D8', fontSize: '12px' }}
                />
                <ReferenceLine
                  x={data.settings.redFlagMarginPct}
                  stroke="#C84B31"
                  strokeDasharray="3 3"
                />
                <Bar dataKey="marginPct" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {channelChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-[#F2EBE2] space-y-1.5 text-xs">
            {summary.channelSummary.map((ch) => (
              <div key={ch.channel} className="flex items-center justify-between">
                <span className="text-[#4B3B34] font-medium">{ch.label}</span>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-[#7D6C63]">
                    {formatNumber(ch.kg, { usePersian: usePersianDigits })} کیلو
                  </span>
                  <span className="font-bold text-[#2B1E1A]">
                    <PrivacyValue>
                      {formatCurrency(ch.netProfit, currencyUnit, usePersianDigits, true)}
                    </PrivacyValue>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Union Price Ceiling Compliance Radar */}
      <section className="bg-white border border-[#EAE2D8] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
              رادار سقف نرخ مصوب اتحادیه قنادان و استراتژی حفاظت قانونی سود
              <HelpTip id="unionRadar" />
            </h2>
            <p className="text-xs text-[#7D6C63] mt-0.5">
              تفکیک آیتم‌های مشمول نرخ مصوب اتحادیه از محصولات تخصصی و راه‌حل حفظ حاشیه سود
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EAE2D8] text-[#6E5C54]">
                <th className="py-2.5 px-3 font-bold">محصول</th>
                <th className="py-2.5 px-3 font-bold">بهای تمام‌شده/کیلو</th>
                <th className="py-2.5 px-3 font-bold">قیمت ویترین</th>
                <th className="py-2.5 px-3 font-bold">سقف نرخ اتحادیه</th>
                <th className="py-2.5 px-3 font-bold">حاشیه سود فعلی</th>
                <th className="py-2.5 px-3 font-bold">وضعیت قانونی و راهکار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3ECE4]">
              {summary.recipeMetrics.map((rm) => {
                const raw = data.recipes.find((r) => r.id === rm.recipeId);
                const ceiling = raw?.unionPriceCeiling;
                return (
                  <tr key={rm.recipeId} className="hover:bg-[#FAF8F5]">
                    <td className="py-2.5 px-3 font-bold text-[#2B1E1A]">{rm.name}</td>
                    <td className="py-2.5 px-3 tabular-nums text-[#4B3B34]">
                      <PrivacyValue>{fmt(rm.totalCostPerKg)}</PrivacyValue>
                    </td>
                    <td className="py-2.5 px-3 tabular-nums font-bold text-[#2B1E1A]">
                      {fmt(rm.storefrontPricePerKg)}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums text-[#4B3B34]">
                      {ceiling ? fmt(ceiling) : 'آیتم تخصصی / آزاد'}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums font-bold">
                      <PrivacyValue>
                        <span
                          className={
                            rm.netMarginPct >= data.settings.targetNetMarginPct
                              ? 'text-[#2D6A4F]'
                              : rm.netMarginPct >= data.settings.redFlagMarginPct
                              ? 'text-[#D97706]'
                              : 'text-[#C84B31]'
                          }
                        >
                          {formatPercent(rm.netMarginPct, usePersianDigits)}
                        </span>
                      </PrivacyValue>
                    </td>
                    <td className="py-2.5 px-3">
                      {rm.unionCeilingStatus === 'exceeded' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#C84B31]">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          بالاتر از سقف مصوب — اصلاح قیمت یا تبدیل به نسخه ویژه/میکس
                        </span>
                      ) : rm.unionCeilingStatus === 'squeezed' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#D97706]">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          فشردگی سود زیر سقف — جبران با پک کادویی میکس
                        </span>
                      ) : rm.unionCeilingStatus === 'compliant' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#2D6A4F]">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          منطبق با نرخ اتحادیه با سود ایمن
                        </span>
                      ) : (
                        <span className="text-[#4338CA] font-medium">
                          محصول تخصصی ارزش‌افزوده (اهرم اصلی سودآوری)
                        </span>
                      )}
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
