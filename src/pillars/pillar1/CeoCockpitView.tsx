import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpLeft,
  CalendarClock,
  CheckCircle2,
  Compass,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useWorkshop } from '../../store/WorkshopContext';
import { solveGoalSeekPaths } from '../../utils/costEngine';
import {
  formatCurrency,
  formatDigits,
  formatNumber,
  formatPercent,
  formatShortToman,
} from '../../utils/formatters';
import { HelpTip } from '../../components/HelpTip';
import { PrivacyValue } from '../../components/PrivacyValue';
import { LocaleNumberInput } from '../../components/LocaleNumberInput';

export const CeoCockpitView: React.FC = () => {
  const { data, summary, monteCarlo, offlineInsights } = useWorkshop();
  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number, compact = false) =>
    formatCurrency(v, currencyUnit, usePersianDigits, compact);

  const [targetRealDraw, setTargetRealDraw] = useState<number>(() =>
    Math.max(50_000_000, Math.round((summary.realSafeOwnerDraw * 1.25) / 10_000_000) * 10_000_000)
  );

  // Morning 60-Second Ritual indicators
  const nearestCheck = useMemo(() => {
    const upcoming = data.checks
      .filter((c) => c.type === 'issued' && c.status !== 'پاس‌شده' && c.daysFromToday >= 0)
      .sort((a, b) => a.daysFromToday - b.daysFromToday);
    return upcoming[0] ?? null;
  }, [data.checks]);

  const topAction = offlineInsights[0] ?? null;

  // Capital Erosion Waterfall Chart data
  const waterfallData = useMemo(() => {
    const rev = Math.round(summary.totalMonthlyRevenue);
    const matPack = Math.round(
      summary.totalMonthlyMaterialCost +
        summary.totalMonthlyPackagingCost +
        summary.totalMonthlyChannelFees
    );
    const ovh = Math.round(summary.totalMonthlyOverheadAndPayroll);
    const nominal = Math.round(summary.nominalMonthlyProfit);
    const infReserve = Math.round(summary.inventoryReplacementReserve);
    const slumpReserve = Math.round(summary.monthlySlumpReserve);
    const realDraw = Math.round(summary.realSafeOwnerDraw);

    const afterMat = rev - matPack;
    const afterInf = nominal - infReserve;

    return [
      {
        name: 'درآمد کل',
        base: 0,
        delta: rev,
        displayValue: rev,
        barColor: '#2B1E1A',
      },
      {
        name: 'مواد و بسته',
        base: Math.max(0, afterMat),
        delta: matPack,
        displayValue: -matPack,
        barColor: '#C84B31',
      },
      {
        name: 'سربار و حقوق',
        base: Math.max(0, nominal),
        delta: ovh,
        displayValue: -ovh,
        barColor: '#D97706',
      },
      {
        name: 'سود اسمی',
        base: 0,
        delta: Math.max(0, nominal),
        displayValue: nominal,
        barColor: '#5B7065',
      },
      {
        name: 'ذخیره تورم',
        base: Math.max(0, afterInf),
        delta: infReserve,
        displayValue: -infReserve,
        barColor: '#EA580C',
      },
      {
        name: 'سپر رکود',
        base: Math.max(0, realDraw),
        delta: slumpReserve,
        displayValue: -slumpReserve,
        barColor: '#4338CA',
      },
      {
        name: 'سود واقعی',
        base: 0,
        delta: Math.max(0, realDraw),
        displayValue: realDraw,
        barColor: '#2D6A4F',
      },
    ];
  }, [summary]);

  const goalPaths = useMemo(
    () => solveGoalSeekPaths(summary, targetRealDraw, data.settings),
    [summary, targetRealDraw, data.settings]
  );

  return (
    <div className="space-y-6">
      {/* Morning 60-Second Ritual Bar */}
      <section
        aria-label="چک‌لیست ۶۰ ثانیه‌ای صبح مدیر"
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        <div className="bg-white border border-[#EAE2D8] rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#ECFDF5] text-[#2D6A4F] flex items-center justify-center shrink-0">
            <Target className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#7D6C63]">
              هدف فروش امروز برای سربه‌سر
            </div>
            <div className="text-base font-extrabold text-[#2B1E1A] tabular-nums mt-0.5">
              <PrivacyValue>{fmt(summary.dailyBreakEvenRevenue, true)}</PrivacyValue>
            </div>
            <div className="text-[11px] text-[#5C4E47] mt-0.5 tabular-nums">
              معادل حدود{' '}
              {formatNumber(
                summary.breakEvenKg / Math.max(1, data.settings.activeWorkingDaysPerMonth),
                { decimals: 1, usePersian: usePersianDigits }
              )}{' '}
              کیلو فروش روزانه
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#EAE2D8] rounded-xl p-4 flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              nearestCheck && nearestCheck.daysFromToday <= 10
                ? 'bg-[#FFFBEB] text-[#D97706]'
                : 'bg-[#FAF8F5] text-[#6E5C54]'
            }`}
          >
            <CalendarClock className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#7D6C63]">
              نزدیک‌ترین چک پرداختی (۱۰ روز آینده)
            </div>
            {nearestCheck ? (
              <>
                <div className="text-base font-extrabold text-[#2B1E1A] tabular-nums mt-0.5">
                  <PrivacyValue>{fmt(nearestCheck.amount, true)}</PrivacyValue>
                </div>
                <div className="text-[11px] text-[#92400E] mt-0.5 truncate">
                  {formatDigits(nearestCheck.daysFromToday, usePersianDigits)} روز مانده ·{' '}
                  {nearestCheck.counterparty}
                </div>
              </>
            ) : (
              <div className="text-sm font-bold text-[#2D6A4F] mt-1">
                چک پرداختی نزدیکی ثبت نشده است
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#EAE2D8] rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] text-[#4338CA] flex items-center justify-center shrink-0">
            <Compass className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#7D6C63]">
              مهم‌ترین اقدام سودآور امروز
            </div>
            <div className="text-xs font-bold text-[#2B1E1A] mt-0.5 line-clamp-2 leading-relaxed">
              {topAction
                ? topAction.title
                : 'منو و قیمت‌ها در تراز سالم قرار دارند؛ کنترل پرت روزانه را ادامه دهید.'}
            </div>
          </div>
        </div>
      </section>

      {/* 5 Executive KPI Cards */}
      <section
        aria-label="شاخص‌های کلیدی مدیرعامل"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5"
      >
        {/* KPI 1: Nominal Profit */}
        <div className="bg-white border border-[#EAE2D8] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#6E5C54] font-medium">
            <span>سود اسمی ماهانه</span>
            <HelpTip id="nominalProfit" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-[#2B1E1A] tabular-nums">
            <PrivacyValue>{fmt(summary.nominalMonthlyProfit, true)}</PrivacyValue>
          </div>
          <div className="mt-1.5 text-[11px] text-[#7D6C63] tabular-nums">
            از کل فروش <PrivacyValue>{fmt(summary.totalMonthlyRevenue, true)}</PrivacyValue>
          </div>
        </div>

        {/* KPI 2: Real Safe Owner Draw (Hero Anchor) */}
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#065F46] font-bold">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              سود واقعی قابل برداشت
            </span>
            <HelpTip id="realSafeDraw" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-[#1B4332] tabular-nums">
            <PrivacyValue>{fmt(summary.realSafeOwnerDraw, true)}</PrivacyValue>
          </div>
          <div className="mt-1.5 text-[11px] text-[#2D6A4F] tabular-nums">
            ذخیره تورم انبار: <PrivacyValue>{fmt(summary.inventoryReplacementReserve, true)}</PrivacyValue>
          </div>
        </div>

        {/* KPI 3: Blended Net Margin */}
        <div className="bg-white border border-[#EAE2D8] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#6E5C54] font-medium">
            <span>حاشیه سود خالص منو</span>
            <HelpTip id="blendedMargin" />
          </div>
          <div
            className={`mt-2 text-xl font-extrabold tabular-nums ${
              summary.blendedNetMarginPct >= data.settings.targetNetMarginPct
                ? 'text-[#2D6A4F]'
                : summary.blendedNetMarginPct >= data.settings.redFlagMarginPct
                ? 'text-[#D97706]'
                : 'text-[#C84B31]'
            }`}
          >
            <PrivacyValue>
              {formatPercent(summary.blendedNetMarginPct, usePersianDigits)}
            </PrivacyValue>
          </div>
          <div className="mt-1.5 text-[11px] text-[#7D6C63] tabular-nums">
            هدف تنظیم‌شده: {formatPercent(data.settings.targetNetMarginPct, usePersianDigits, 0)}
          </div>
        </div>

        {/* KPI 4: Break-Even */}
        <div className="bg-white border border-[#EAE2D8] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#6E5C54] font-medium">
            <span>نقطه سربه‌سر ماهانه</span>
            <HelpTip id="breakEven" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-[#2B1E1A] tabular-nums">
            <PrivacyValue>{fmt(summary.breakEvenRevenue, true)}</PrivacyValue>
          </div>
          <div className="mt-1.5 text-[11px] text-[#7D6C63] tabular-nums">
            روز ورود به سود: روز {formatDigits(summary.breakEvenDayOfMonth, usePersianDigits)} ·{' '}
            {formatNumber(summary.breakEvenKg, { decimals: 0, usePersian: usePersianDigits })} کیلو
          </div>
        </div>

        {/* KPI 5: Monte Carlo Profit Probability */}
        <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#312E81] font-bold">
            <span>احتمال سوددهی ماه بعد</span>
            <HelpTip id="mcProfitProb" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-[#4338CA] tabular-nums">
            {formatPercent(monteCarlo.probabilityOfProfitPct, usePersianDigits)}
          </div>
          <div className="mt-1.5 text-[11px] text-[#4338CA]/85 tabular-nums">
            بر پایه {formatNumber(monteCarlo.iterations, { usePersian: usePersianDigits })} سناریوی مونت‌کارلو
          </div>
        </div>
      </section>

      {/* Main Analytical Row: Capital Erosion Waterfall + Goal-Seek Reverse Solver */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Capital Erosion Waterfall Chart */}
        <section className="xl:col-span-7 bg-white border border-[#EAE2D8] rounded-xl p-5 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
                نمودار آبشاری فرسایش سرمایه و سود واقعی
                <HelpTip id="waterfallChart" />
              </h2>
              <p className="text-xs text-[#7D6C63] mt-0.5">
                تفکیک شفاف سود اسمی از ذخیره جایگزینی انبار (تورم{' '}
                {formatPercent(summary.weightedMaterialInflationPct, usePersianDigits)} ماهانه) و سپر رکود
              </p>
            </div>
            <div className="text-left text-[11px] text-[#5A4A42] shrink-0">
              <div className="font-bold text-[#2D6A4F] tabular-nums">
                نسبت سود واقعی به اسمی:{' '}
                {formatPercent(
                  summary.nominalMonthlyProfit > 0
                    ? (summary.realSafeOwnerDraw / summary.nominalMonthlyProfit) * 100
                    : 0,
                  usePersianDigits,
                  0
                )}
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} margin={{ top: 12, right: 12, left: 10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DE" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#4B3B34' }}
                  axisLine={{ stroke: '#EAE2D8' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#7D6C63' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatShortToman(Number(v), usePersianDigits)}
                />
                <Tooltip
                  formatter={(_val: unknown, _name: unknown, props: { payload?: { displayValue?: number } }) => {
                    const dv = props?.payload?.displayValue ?? 0;
                    return [
                      data.settings.privacyMode ? '•••••' : fmt(dv, false),
                      'مبلغ ماهانه',
                    ];
                  }}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #EAE2D8',
                    fontSize: '12px',
                    direction: 'rtl',
                  }}
                />
                <ReferenceLine y={0} stroke="#C8B8AF" />
                <Bar dataKey="base" stackId="wf" fill="transparent" fillOpacity={0} stroke="none" isAnimationActive={false} />
                <Bar dataKey="delta" stackId="wf" radius={[5, 5, 5, 5]} maxBarSize={48} isAnimationActive={false}>
                  {waterfallData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.barColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Concise Numeric Legend Strip */}
          <div className="mt-3 pt-3 border-t border-[#F2EBE2] grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-[#7D6C63]">ذخیره تورم انبار: </span>
              <span className="font-bold text-[#EA580C] tabular-nums">
                <PrivacyValue>{fmt(summary.inventoryReplacementReserve, true)}</PrivacyValue>
              </span>
            </div>
            <div>
              <span className="text-[#7D6C63]">ذخیره سپر رکود: </span>
              <span className="font-bold text-[#4338CA] tabular-nums">
                <PrivacyValue>{fmt(summary.monthlySlumpReserve, true)}</PrivacyValue>
              </span>
            </div>
            <div>
              <span className="text-[#7D6C63]">برداشت امن مدیر: </span>
              <span className="font-bold text-[#2D6A4F] tabular-nums">
                <PrivacyValue>{fmt(summary.realSafeOwnerDraw, true)}</PrivacyValue>
              </span>
            </div>
          </div>
        </section>

        {/* Goal-Seek Reverse Solver */}
        <section className="xl:col-span-5 bg-white border border-[#EAE2D8] rounded-xl p-5 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
              مهندسی معکوس سود دلخواه (Goal-Seek)
              <HelpTip id="goalSeek" />
            </h2>
            <p className="text-xs text-[#7D6C63] mt-0.5">
              سود واقعی قابل برداشت هدف را وارد کنید تا ۳ مسیر قطعی ریاضی محاسبه شود.
            </p>
          </div>

          <div className="mb-4">
            <label
              htmlFor="goal-seek-input"
              className="block text-xs font-bold text-[#4B3B34] mb-1.5"
            >
              هدف «سود واقعی قابل برداشت ماهانه» (تومان):
            </label>
            <LocaleNumberInput
              id="goal-seek-input"
              value={targetRealDraw}
              onChange={setTargetRealDraw}
              suffix="تومان"
            />
          </div>

          <div className="space-y-3 flex-1">
            {goalPaths.map((path, idx) => (
              <div
                key={path.id}
                className={`rounded-xl p-3.5 border ${
                  idx === 2 || path.id === 'achieved'
                    ? 'bg-[#ECFDF5]/60 border-[#A7F3D0]'
                    : 'bg-[#FAF8F5] border-[#EAE2D8]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
                    {path.id === 'achieved' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#2D6A4F]" />
                    ) : (
                      <ArrowUpLeft className="w-4 h-4 text-[#2D6A4F]" />
                    )}
                    <span>{path.title}</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#2D6A4F] tabular-nums shrink-0">
                    {formatDigits(path.metricBadge, usePersianDigits)}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-[11px] text-[#4B3B34] pr-4 list-disc">
                  {path.steps.map((s, i) => (
                    <li key={i}>{formatDigits(s, usePersianDigits)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {summary.realSafeOwnerDraw <= 0 && (
            <div className="mt-3 rounded-lg bg-[#FEF2F2] border border-[#F5C2B8] p-2.5 text-[11px] text-[#991B1B] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>سود واقعی فعلی صفر است؛ ابتدا قیمت فروش یا ضایعات را اصلاح کنید.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
