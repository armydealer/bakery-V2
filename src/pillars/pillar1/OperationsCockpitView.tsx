import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Flame, Trash2 } from 'lucide-react';
import { useWorkshop } from '../../store/WorkshopContext';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShortToman,
} from '../../utils/formatters';
import { HelpTip } from '../../components/HelpTip';
import { PrivacyValue } from '../../components/PrivacyValue';

export const OperationsCockpitView: React.FC = () => {
  const { data, summary } = useWorkshop();
  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number, compact = true) =>
    formatCurrency(v, currencyUnit, usePersianDigits, compact);

  const ovenRanked = [...summary.recipeMetrics]
    .sort((a, b) => b.profitPerOvenHour - a.profitPerOvenHour)
    .map((r, idx) => ({
      name: r.name,
      profitPerOvenHour: Math.round(r.profitPerOvenHour),
      monthlyOvenHours: Number(r.monthlyOvenHours.toFixed(1)),
      fill: idx === 0 ? '#2D6A4F' : idx <= 2 ? '#40916C' : '#D97706',
    }));

  const paretoData = summary.paretoIngredients.slice(0, 8).map((p) => ({
    name: p.name.split(' ').slice(0, 2).join(' '),
    fullName: p.name,
    spend: Math.round(p.monthlySpend),
    cumPct: Number(p.cumulativePct.toFixed(1)),
  }));

  const waste = summary.wasteBreakdown;
  const wasteRows = [
    {
      label: 'افت پخت و تبخیر در فر',
      amount: waste.bakingShrinkageCost,
      color: '#D97706',
      note: 'ناشی از کاهش وزن طبیعی خمیر در حرارت فر',
    },
    {
      label: 'دورریز برش و لبه‌گیری (Trim)',
      amount: waste.trimWasteCost,
      color: '#EA580C',
      note: 'برش کناره‌های ناپلئونی، رولت و کیک',
    },
    {
      label: 'ضایعات ماندگاری ویترین (بیاتی)',
      amount: waste.shelfLifeSpoilageCost,
      color: '#C84B31',
      note: 'قابل کاهش با حراج آخر شب و تولید نوبتی',
    },
    {
      label: 'پرت نامرئی و مغایرت انبار',
      amount: waste.invisibleVarianceCost,
      color: '#991B1B',
      note: 'اختلاف مصرف واقعی انبار نسبت به دستور پخت',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Utilization Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-white border border-[#EAE2D8] rounded-xl p-4">
          <div className="text-xs text-[#6E5C54] font-medium flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#D97706]" />
            <span>ضریب اشغال ظرفیت فر کارگاه</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#2B1E1A] tabular-nums">
            {formatPercent(summary.ovenUtilizationPct, usePersianDigits)}
          </div>
          <div className="mt-1 text-[11px] text-[#7D6C63] tabular-nums">
            {formatNumber(summary.usedOvenHours, { decimals: 1, usePersian: usePersianDigits })} ساعت از{' '}
            {formatNumber(summary.monthlyOvenCapacityHours, { usePersian: usePersianDigits })} ساعت ظرفیت ماهانه
          </div>
        </div>

        <div className="bg-white border border-[#EAE2D8] rounded-xl p-4">
          <div className="text-xs text-[#6E5C54] font-medium">قهرمان سود در هر ساعت فر</div>
          <div className="mt-2 text-lg font-extrabold text-[#2D6A4F] truncate">
            {ovenRanked[0]?.name ?? '—'}
          </div>
          <div className="mt-1 text-[11px] text-[#2D6A4F] font-semibold tabular-nums">
            <PrivacyValue>
              {ovenRanked[0] ? `${fmt(ovenRanked[0].profitPerOvenHour, false)} / ساعت فر` : '—'}
            </PrivacyValue>
          </div>
        </div>

        <div className="bg-[#FEF2F2] border border-[#F5C2B8] rounded-xl p-4">
          <div className="text-xs text-[#991B1B] font-bold flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" />
            <span>کل هزینه پرت، افت و ضایعات ماهانه</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#991B1B] tabular-nums">
            <PrivacyValue>{fmt(waste.totalWasteCost, true)}</PrivacyValue>
          </div>
          <div className="mt-1 text-[11px] text-[#B91C1C]">
            پتانسیل مستقیم افزایش سود بدون نیاز به مشتری جدید
          </div>
        </div>
      </div>

      {/* Main Charts: Oven-Hour Ranking + Pareto 80/20 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <section className="xl:col-span-6 bg-white border border-[#EAE2D8] rounded-xl p-5 flex flex-col">
          <div className="mb-3">
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
              رتبه‌بندی سود در هر ساعت فر (نظریه محدودیت‌ها)
              <HelpTip id="ovenBottleneck" />
            </h2>
            <p className="text-xs text-[#7D6C63] mt-0.5">
              سود خالص تولیدی به ازای هر ۶۰ دقیقه اشغال فر (با لحاظ ظرفیت سینی‌ها)
            </p>
          </div>

          <div className="h-[300px] w-full flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ovenRanked}
                layout="vertical"
                margin={{ top: 8, right: 20, left: 10, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DE" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#5A4A42' }}
                  tickFormatter={(v) => formatShortToman(Number(v), usePersianDigits)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={132}
                  tick={{ fontSize: 11, fill: '#2B1E1A' }}
                />
                <Tooltip
                  formatter={(v: unknown) => [
                    data.settings.privacyMode ? '•••••' : fmt(Number(v), false),
                    'سود در ۱ ساعت فر',
                  ]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #EAE2D8', fontSize: '12px' }}
                />
                <Bar dataKey="profitPerOvenHour" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {ovenRanked.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="xl:col-span-6 bg-white border border-[#EAE2D8] rounded-xl p-5 flex flex-col">
          <div className="mb-3">
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
              نمودار پارتو ۸۰/۲۰ محرک‌های خرید مواد اولیه
              <HelpTip id="paretoChart" />
            </h2>
            <p className="text-xs text-[#7D6C63] mt-0.5">
              شناسایی ۳ تا ۴ قلم اصلی که حدود ۸۰٪ نقدینگی خرید ماهانه کارگاه را مصرف می‌کنند
            </p>
          </div>

          <div className="h-[300px] w-full flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={paretoData} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DE" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#4B3B34' }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#5A4A42' }}
                  tickFormatter={(v) => formatShortToman(Number(v), usePersianDigits)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#4338CA' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => {
                    if (name === 'cumPct') return [`${v}٪`, 'سهم تجمعی'];
                    return [data.settings.privacyMode ? '•••••' : fmt(Number(v), false), 'خرید ماهانه'];
                  }}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #EAE2D8', fontSize: '12px' }}
                />
                <Bar yAxisId="left" dataKey="spend" fill="#2B1E1A" radius={[5, 5, 0, 0]} maxBarSize={36} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumPct"
                  stroke="#4338CA"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#4338CA' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Waste & Spoilage 4-Part Breakdown */}
      <section className="bg-white border border-[#EAE2D8] rounded-xl p-5">
        <div className="mb-4">
          <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
            شاخص تفکیکی افت پخت، برش، بیاتی و پرت نامرئی
            <HelpTip id="wasteIndex" />
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {wasteRows.map((row) => {
            const share = waste.totalWasteCost > 0 ? (row.amount / waste.totalWasteCost) * 100 : 0;
            return (
              <div
                key={row.label}
                className="rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-[#2B1E1A]">{row.label}</div>
                  <div
                    className="mt-2 text-lg font-extrabold tabular-nums"
                    style={{ color: row.color }}
                  >
                    <PrivacyValue>{fmt(row.amount, true)}</PrivacyValue>
                  </div>
                  <div className="mt-1 text-[11px] text-[#6E5C54]">{row.note}</div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-[#7D6C63] mb-1 tabular-nums">
                    <span>سهم از کل ضایعات</span>
                    <span>{formatPercent(share, usePersianDigits, 0)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#EAE2D8] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, share)}%`, backgroundColor: row.color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
