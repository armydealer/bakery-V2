import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
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
  CalendarRange,
  CheckCircle2,
  Flame,
  Landmark,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useWorkshop } from '../store/WorkshopContext';
import {
  computeCashflowStressTimeline,
  computeTrueMonthlyStaffCost,
  computeWorkshopSummary,
} from '../utils/costEngine';
import {
  formatCurrency,
  formatDigits,
  formatNumber,
  formatPercent,
  formatShortToman,
  roundToStep,
  safeDiv,
} from '../utils/formatters';
import { OverheadItem, SayadiCheck, StaffMember } from '../types';
import { HelpTip } from '../components/HelpTip';
import { GuidedBanner } from '../components/GuidedBanner';
import { LocaleNumberInput } from '../components/LocaleNumberInput';
import { PrivacyValue } from '../components/PrivacyValue';

type CfoTab = 'payroll_overhead' | 'seasonal' | 'checks' | 'shock_capex';

export const Pillar5Cfo: React.FC = () => {
  const {
    data,
    summary,
    updateSettings,
    upsertStaff,
    deleteStaff,
    upsertOverhead,
    deleteOverhead,
    upsertCheck,
    deleteCheck,
    updateSeasonalCurve,
    bulkUpdateRecipePrices,
  } = useWorkshop();

  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number, compact = false) =>
    formatCurrency(v, currencyUnit, usePersianDigits, compact);

  const [activeTab, setActiveTab] = useState<CfoTab>('payroll_overhead');

  // New Staff Form
  const [stName, setStName] = useState('');
  const [stRole, setStRole] = useState('قناد کارگاه');
  const [stBase, setStBase] = useState(18_000_000);
  const [stBen, setStBen] = useState(2_000_000);

  // New Overhead Form
  const [ohName, setOhName] = useState('');
  const [ohCat, setOhCat] = useState<OverheadItem['category']>('انرژی و فر');
  const [ohAmt, setOhAmt] = useState(6_000_000);

  // New Sayadi Check Form
  const [chkType, setChkType] = useState<'issued' | 'received'>('issued');
  const [chkParty, setChkParty] = useState('');
  const [chkAmt, setChkAmt] = useState(40_000_000);
  const [chkDate, setChkDate] = useState('۱۴۰۴/۱۰/۲۸');
  const [chkDays, setChkDays] = useState(25);
  const [chkSayadi, setChkSayadi] = useState('');

  // Tab 5D: Inflation Shock Sliders
  const [shocks, setShocks] = useState({
    butter_oil: 0,
    flour_sugar: 0,
    nuts_spice: 0,
    dairy_egg: 0,
    packaging_overhead: 0,
  });

  // Tab 5D: CapEx / Hiring Payback Simulator
  const [investTitle, setInvestTitle] = useState('خرید فر گردان ۱۶ سینی جدید');
  const [capexCost, setCapexCost] = useState(240_000_000);
  const [extraMonthlyFixedCost, setExtraMonthlyFixedCost] = useState(8_000_000);
  const [expectedExtraDailyKg, setExpectedExtraDailyKg] = useState(12);

  // 5B Seasonal Slump Machine calculations
  const seasonalAnalysis = useMemo(() => {
    const avgMult =
      data.seasonalCurve.reduce((s, m) => s + m.demandMultiplier, 0) /
      Math.max(1, data.seasonalCurve.length);
    const baseVar =
      summary.totalMonthlyMaterialCost +
      summary.totalMonthlyPackagingCost +
      summary.totalMonthlyChannelFees;
    const baseOvh = summary.totalMonthlyOverheadAndPayroll;

    const rows = data.seasonalCurve.map((m) => {
      const rev = summary.totalMonthlyRevenue * m.demandMultiplier;
      const variable = baseVar * m.demandMultiplier;
      const profit = rev - variable - baseOvh;
      const vsAvg = profit - summary.nominalMonthlyProfit;
      return {
        ...m,
        revenue: Math.round(rev),
        profit: Math.round(profit),
        vsAvg: Math.round(vsAvg),
        isSlump: m.demandMultiplier < 0.88,
        isPeak: m.demandMultiplier >= 1.25,
      };
    });

    const totalSlumpShortfall = rows
      .filter((r) => r.vsAvg < 0)
      .reduce((s, r) => s + Math.abs(r.vsAvg), 0);
    const peakMonthsCount = Math.max(1, rows.filter((r) => r.isPeak).length);
    const requiredPeakMonthlySave = totalSlumpShortfall / peakMonthsCount;

    return { rows, avgMult, totalSlumpShortfall, requiredPeakMonthlySave };
  }, [data.seasonalCurve, summary]);

  // 5C Sayadi Cashflow Stress Test
  const cashflowStress = useMemo(
    () => computeCashflowStressTimeline(data, summary, 35),
    [data, summary]
  );

  // 5D Inflation Shock Live Simulation
  const shockSim = useMemo(() => {
    const hasShock = Object.values(shocks).some((v) => v !== 0);
    const shockedData = {
      ...data,
      ingredients: data.ingredients.map((ing) => {
        let pct = 0;
        if (ing.category === 'butter_oil') pct = shocks.butter_oil;
        else if (ing.category === 'flour_sugar') pct = shocks.flour_sugar;
        else if (ing.category === 'nuts_spice') pct = shocks.nuts_spice;
        else if (ing.category === 'dairy_egg') pct = shocks.dairy_egg;
        else if (ing.category === 'packaging') pct = shocks.packaging_overhead;
        return pct !== 0 ? { ...ing, packPrice: ing.packPrice * (1 + pct / 100) } : ing;
      }),
      overheads: data.overheads.map((o) =>
        shocks.packaging_overhead !== 0
          ? { ...o, monthlyAmount: o.monthlyAmount * (1 + shocks.packaging_overhead / 100) }
          : o
      ),
    };
    const nextSummary = computeWorkshopSummary(shockedData);
    const profitImpact = nextSummary.nominalMonthlyProfit - summary.nominalMonthlyProfit;
    const priceRecommendations = nextSummary.recipeMetrics.map((rm) => {
      const orig = summary.recipeMetrics.find((o) => o.recipeId === rm.recipeId);
      const costDiff = rm.totalCostPerKg - (orig?.totalCostPerKg ?? rm.totalCostPerKg);
      const newPrice = roundToStep(
        rm.storefrontPricePerKg + Math.max(0, costDiff),
        data.settings.priceRoundingStep
      );
      return {
        recipeId: rm.recipeId,
        name: rm.name,
        oldPrice: rm.storefrontPricePerKg,
        newPrice,
        costDiff,
      };
    });
    return { hasShock, nextSummary, profitImpact, priceRecommendations };
  }, [shocks, data, summary]);

  // 5D CapEx & Hiring Payback calculation
  const paybackCalc = useMemo(() => {
    const activeDays = Math.max(1, data.settings.activeWorkingDaysPerMonth);
    const avgContributionPerKg = Math.max(
      40000,
      safeDiv(
        summary.totalMonthlyRevenue -
          summary.totalMonthlyMaterialCost -
          summary.totalMonthlyPackagingCost -
          summary.totalMonthlyChannelFees,
        Math.max(1, summary.totalMonthlySalesKg),
        160000
      )
    );
    const grossExtraMonthlyProfit = expectedExtraDailyKg * activeDays * avgContributionPerKg;
    const netExtraMonthlyProfit = grossExtraMonthlyProfit - extraMonthlyFixedCost;
    const paybackMonths =
      netExtraMonthlyProfit > 0 ? safeDiv(capexCost, netExtraMonthlyProfit, Infinity) : Infinity;
    const minDailyKgBreakEven = safeDiv(
      extraMonthlyFixedCost + safeDiv(capexCost, 12, 0),
      activeDays * avgContributionPerKg,
      0
    );
    return {
      grossExtraMonthlyProfit,
      netExtraMonthlyProfit,
      paybackMonths,
      minDailyKgBreakEven,
      verdict:
        netExtraMonthlyProfit > 0 && paybackMonths <= 10
          ? ('go' as const)
          : netExtraMonthlyProfit > 0 && paybackMonths <= 18
          ? ('caution' as const)
          : ('wait' as const),
    };
  }, [capexCost, extraMonthlyFixedCost, expectedExtraDailyKg, data.settings, summary]);

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stName.trim()) return;
    const member: StaffMember = {
      id: `st-${Date.now()}`,
      name: stName.trim(),
      role: stRole.trim() || 'قناد',
      baseMonthlySalary: stBase,
      monthlyBenefits: stBen,
      includeInsurance23: data.settings.defaultIncludeInsurance23,
      includeEidi: data.settings.defaultIncludeEidi,
      includeSanavat: data.settings.defaultIncludeSanavat,
      active: true,
    };
    upsertStaff(member);
    setStName('');
  };

  const handleAddOverhead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ohName.trim()) return;
    upsertOverhead({
      id: `oh-${Date.now()}`,
      name: ohName.trim(),
      category: ohCat,
      monthlyAmount: ohAmt,
      active: true,
    });
    setOhName('');
  };

  const handleAddCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chkParty.trim() || chkAmt <= 0) return;
    const next: SayadiCheck = {
      id: `chk-${Date.now()}`,
      type: chkType,
      counterparty: chkParty.trim(),
      amount: chkAmt,
      dueDateShamsi: chkDate.trim() || '۱۴۰۴/۱۰/۳۰',
      daysFromToday: chkDays,
      sayadiId: chkSayadi.trim() || '۹۰۰۱۲۳۴۵۶۷۸۹۰۱۲۳',
      status: 'در جریان',
    };
    upsertCheck(next);
    setChkParty('');
    setChkSayadi('');
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold text-[#2B1E1A]">
          مالی کارگاه، نقدینگی، فصل‌های ایران و شبیه‌ساز شوک و رشد
        </h1>
        <p className="text-xs text-[#7D6C63] mt-0.5">
          موتور حقوق قانون کار ایران (بیمه ۲۳٪، عیدی و سنوات)، سپر رکود فصلی، نگهبان چک صیادی و شبیه‌ساز تورم
        </p>
      </div>

      {/* Sub-Tabs */}
      <div
        role="tablist"
        aria-label="تب‌های مدیریت مالی کارگاه"
        className="mb-5 flex flex-wrap gap-1.5 bg-white border border-[#EAE2D8] rounded-xl p-1.5"
      >
        {[
          { id: 'payroll_overhead' as const, label: '۵A. سربار و حقوق قانون کار ایران', icon: Users },
          { id: 'seasonal' as const, label: '۵B. ماشین‌زمان ۱۲ ماهه فصلی و سپر رکود', icon: CalendarRange },
          { id: 'checks' as const, label: '۵C. نگهبان چک صیادی و رادار نقدینگی', icon: Receipt },
          { id: 'shock_capex' as const, label: '۵D. شوک تورم و شبیه‌ساز دستگاه/استخدام', icon: Flame },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#2B1E1A] text-white'
                  : 'text-[#5A4A42] hover:bg-[#FAF8F5] hover:text-[#2B1E1A]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'payroll_overhead' && (
        <div className="space-y-5">
          <GuidedBanner text="بیمه ۲۳٪ کارفرما، ذخیره ماهانه عیدی و سنوات را روشن نگه دارید تا عیدی اسفندماه هرگز نقدینگی کارگاه را غافلگیر نکند." />

          {/* Summary Strip + Allocation Switcher */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div className="bg-white border border-[#EAE2D8] rounded-xl p-4">
              <div className="text-xs text-[#6E5C54]">حقوق و مزایای پرداختی ماهانه</div>
              <div className="text-lg font-extrabold text-[#2B1E1A] tabular-nums mt-1">
                <PrivacyValue>{fmt(summary.totalMonthlyBasePayroll, true)}</PrivacyValue>
              </div>
            </div>
            <div className="bg-[#FFFBEB] border border-[#F5D08A] rounded-xl p-4">
              <div className="text-xs font-bold text-[#92400E] flex items-center">
                ذخیره بیمه ۲۳٪ + عیدی + سنوات
                <HelpTip id="iranianPayroll" />
              </div>
              <div className="text-lg font-extrabold text-[#B45309] tabular-nums mt-1">
                <PrivacyValue>{fmt(summary.totalMonthlyLaborLawAccruals, true)}</PrivacyValue>
              </div>
            </div>
            <div className="bg-white border border-[#EAE2D8] rounded-xl p-4">
              <div className="text-xs text-[#6E5C54]">سربار ثابت (اجاره، انرژی، استهلاک)</div>
              <div className="text-lg font-extrabold text-[#2B1E1A] tabular-nums mt-1">
                <PrivacyValue>{fmt(summary.totalMonthlyFixedOverhead, true)}</PrivacyValue>
              </div>
            </div>
            <div className="bg-[#FAF8F5] border border-[#EAE2D8] rounded-xl p-4">
              <div className="text-xs font-bold text-[#4B3B34] flex items-center mb-1.5">
                روش سرشکن سربار روی منو
                <HelpTip id="overheadAllocation" />
              </div>
              <select
                value={data.settings.overheadAllocationMethod}
                onChange={(e) =>
                  updateSettings({
                    overheadAllocationMethod: e.target.value as 'weight' | 'time_abc' | 'hybrid',
                  })
                }
                className="w-full rounded-lg border border-[#EAE2D8] bg-white px-2.5 py-1.5 text-xs font-bold"
              >
                <option value="weight">وزنی (بر اساس کیلوگرم فروش)</option>
                <option value="time_abc">زمانی ABC (ساعت فر و کار)</option>
                <option value="hybrid">ترکیبی ۵۰/۵۰ (پیشنهادی)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Staff Payroll Table & Add Form */}
            <section className="xl:col-span-7 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-extrabold text-[#2B1E1A]">
                پرسنل کارگاه و محاسبه‌گر قانون کار ایران
              </h2>

              <div className="space-y-2.5">
                {data.staff.map((st) => {
                  const calc = computeTrueMonthlyStaffCost(st);
                  return (
                    <div
                      key={st.id}
                      className="rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] p-3.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-extrabold text-[#2B1E1A]">
                            {st.name} <span className="font-normal text-[#7D6C63]">— {st.role}</span>
                          </div>
                          <div className="text-[11px] text-[#5A4A42] tabular-nums mt-0.5">
                            پایه و مزایا: <PrivacyValue>{fmt(calc.baseAndBenefits, true)}</PrivacyValue> · سربار قانونی:{' '}
                            <strong className="text-[#D97706]">
                              <PrivacyValue>
                                {fmt(calc.insurance23 + calc.eidiAccrual + calc.sanavatAccrual, true)}
                              </PrivacyValue>
                            </strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-[#2B1E1A] tabular-nums">
                            هزینه واقعی: <PrivacyValue>{fmt(calc.totalTrueCost, true)}</PrivacyValue>
                          </span>
                          <button
                            type="button"
                            aria-label={`حذف ${st.name}`}
                            onClick={() => deleteStaff(st.id)}
                            className="p-1 text-[#C84B31] hover:bg-[#FEF2F2] rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 text-[11px]">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={st.includeInsurance23}
                            onChange={(e) =>
                              upsertStaff({ ...st, includeInsurance23: e.target.checked })
                            }
                            className="accent-[#2D6A4F]"
                          />
                          <span>بیمه ۲۳٪ کارفرما</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={st.includeEidi}
                            onChange={(e) => upsertStaff({ ...st, includeEidi: e.target.checked })}
                            className="accent-[#2D6A4F]"
                          />
                          <span>ذخیره عیدی (۲/۱۲)</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={st.includeSanavat}
                            onChange={(e) =>
                              upsertStaff({ ...st, includeSanavat: e.target.checked })
                            }
                            className="accent-[#2D6A4F]"
                          />
                          <span>ذخیره سنوات (۱/۱۲)</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleAddStaff} className="pt-3 border-t border-[#F2EBE2] grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  required
                  type="text"
                  value={stName}
                  onChange={(e) => setStName(e.target.value)}
                  placeholder="نام همکار جدید"
                  className="rounded-lg border border-[#EAE2D8] px-2.5 py-2 text-xs"
                />
                <input
                  type="text"
                  value={stRole}
                  onChange={(e) => setStRole(e.target.value)}
                  placeholder="سمت (مثلاً فرکار)"
                  className="rounded-lg border border-[#EAE2D8] px-2.5 py-2 text-xs"
                />
                <LocaleNumberInput value={stBase} onChange={setStBase} placeholder="حقوق پایه" />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن نیرو</span>
                </button>
              </form>
            </section>

            {/* Fixed Overhead Items */}
            <section className="xl:col-span-5 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-extrabold text-[#2B1E1A]">هزینه‌های ثابت و سربار ماهانه</h2>

              <div className="space-y-2">
                {data.overheads.map((oh) => (
                  <div
                    key={oh.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#EAE2D8] bg-[#FAF8F5] px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#2B1E1A]">{oh.name}</div>
                      <div className="text-[11px] text-[#7D6C63]">{oh.category}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold tabular-nums">
                        <PrivacyValue>{fmt(oh.monthlyAmount, true)}</PrivacyValue>
                      </span>
                      <button
                        type="button"
                        aria-label={`حذف ${oh.name}`}
                        onClick={() => deleteOverhead(oh.id)}
                        className="p-1 text-[#C84B31] hover:bg-[#FEF2F2] rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddOverhead} className="pt-3 border-t border-[#F2EBE2] space-y-2">
                <input
                  required
                  type="text"
                  value={ohName}
                  onChange={(e) => setOhName(e.target.value)}
                  placeholder="عنوان هزینه جدید (مثلاً بیمه آتش‌سوزی)"
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={ohCat}
                    onChange={(e) => setOhCat(e.target.value as OverheadItem['category'])}
                    className="rounded-lg border border-[#EAE2D8] bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="اجاره و ملک">اجاره و ملک</option>
                    <option value="انرژی و فر">انرژی و فر</option>
                    <option value="استهلاک تجهیزات">استهلاک تجهیزات</option>
                    <option value="بازاریابی و اداری">بازاریابی و اداری</option>
                    <option value="سایر">سایر</option>
                  </select>
                  <LocaleNumberInput value={ohAmt} onChange={setOhAmt} suffix="تومان" />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-[#2B1E1A] text-white text-xs font-bold hover:bg-[#3E2D27] cursor-pointer"
                >
                  افزودن ردیف سربار
                </button>
              </form>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'seasonal' && (
        <div className="space-y-5">
          <GuidedBanner text="ضریب تقاضای هر ماه شمسی را مطابق محله و مشتریان خود تنظیم کنید تا ببینید در اسفند و آذر چقدر باید برای سپر رکود تابستان ذخیره کنید." />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl p-4">
              <div className="text-xs font-bold text-[#312E81] flex items-center">
                ذخیره پیشنهادی در هر ماه پیک (اسفند/آذر)
                <HelpTip id="seasonalSlumpShield" />
              </div>
              <div className="text-xl font-extrabold text-[#4338CA] tabular-nums mt-1.5">
                <PrivacyValue>{fmt(seasonalAnalysis.requiredPeakMonthlySave, true)}</PrivacyValue>
              </div>
            </div>
            <div className="bg-white border border-[#EAE2D8] rounded-xl p-4">
              <div className="text-xs text-[#6E5C54]">مجموع افت سود در ماه‌های رکود سال</div>
              <div className="text-xl font-extrabold text-[#D97706] tabular-nums mt-1.5">
                <PrivacyValue>{fmt(seasonalAnalysis.totalSlumpShortfall, true)}</PrivacyValue>
              </div>
            </div>
            <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
              <div className="text-xs font-bold text-[#065F46]">نرخ سپر رکود تنظیم‌شده در سود واقعی</div>
              <div className="text-xl font-extrabold text-[#2D6A4F] tabular-nums mt-1.5">
                {formatPercent(data.settings.slumpReserveRatePct, usePersianDigits, 0)} از سود ماهانه
              </div>
            </div>
          </div>

          <section className="bg-white border border-[#EAE2D8] rounded-xl p-5">
            <h2 className="text-sm font-extrabold text-[#2B1E1A] mb-3">
              نمودار سود ۱۲ ماهه تقویم قنادی ایران (از فروردین تا اسفند)
            </h2>
            <div className="h-[260px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seasonalAnalysis.rows} margin={{ top: 10, right: 12, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DE" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4B3B34' }} />
                  <YAxis
                    tick={{ fontSize: 10.5, fill: '#5A4A42' }}
                    tickFormatter={(v) => formatShortToman(Number(v), usePersianDigits)}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [
                      data.settings.privacyMode ? '•••••' : fmt(Number(v)),
                      'سود پیش‌بینی‌شده',
                    ]}
                    contentStyle={{ borderRadius: '10px', border: '1px solid #EAE2D8', fontSize: '12px' }}
                  />
                  <ReferenceLine y={0} stroke="#C84B31" />
                  <Bar dataKey="profit" radius={[5, 5, 0, 0]} maxBarSize={36}>
                    {seasonalAnalysis.rows.map((r, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          r.profit < 0
                            ? '#C84B31'
                            : r.isPeak
                            ? '#2D6A4F'
                            : r.isSlump
                            ? '#D97706'
                            : '#4338CA'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Editable 12-Month Multipliers */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {data.seasonalCurve.map((m) => (
                <div key={m.index} className="rounded-lg border border-[#EAE2D8] bg-[#FAF8F5] p-2.5">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>{m.name}</span>
                    <span className="text-[#4338CA] tabular-nums">
                      ×{formatNumber(m.demandMultiplier, { decimals: 2, usePersian: usePersianDigits })}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.2}
                    step={0.05}
                    value={m.demandMultiplier}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateSeasonalCurve(
                        data.seasonalCurve.map((x) =>
                          x.index === m.index ? { ...x, demandMultiplier: val } : x
                        )
                      );
                    }}
                    className="w-full accent-[#4338CA]"
                  />
                  <div className="text-[10px] text-[#7D6C63] truncate mt-0.5">{m.occasion}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'checks' && (
        <div className="space-y-5">
          <GuidedBanner text="چک‌های صیادی پرداختی به بنکداران و چک‌های دریافتی از کافه‌ها را ثبت کنید تا نمودار تست استرس نقدینگی روزهای خطر را از قبل نشان دهد." />

          {/* Cashflow Stress Test Chart */}
          <section className="bg-white border border-[#EAE2D8] rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
                  نمودار تست استرس نقدینگی در برابر چک‌های صیادی (۳۵ روز آینده)
                  <HelpTip id="sayadiGuard" />
                </h2>
                <p className="text-xs text-[#7D6C63] mt-0.5">
                  شروع با موجودی نقد اولیه {fmt(data.settings.openingCashBalance, true)} · حداقل موجودی پیش‌بینی‌شده:{' '}
                  <strong
                    className={
                      cashflowStress.minBalance < 25_000_000 ? 'text-[#C84B31]' : 'text-[#2D6A4F]'
                    }
                  >
                    <PrivacyValue>{fmt(cashflowStress.minBalance, true)}</PrivacyValue>
                  </strong>
                </p>
              </div>
              <div className="w-48">
                <label className="block text-[11px] font-bold text-[#6E5C54] mb-0.5">
                  موجودی نقد فعلی حساب (تومان)
                </label>
                <LocaleNumberInput
                  value={data.settings.openingCashBalance}
                  onChange={(v) => updateSettings({ openingCashBalance: v })}
                />
              </div>
            </div>

            <div className="h-[240px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflowStress.points} margin={{ top: 10, right: 14, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DE" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#5A4A42' }} interval={4} />
                  <YAxis
                    tick={{ fontSize: 10.5, fill: '#5A4A42' }}
                    tickFormatter={(v) => formatShortToman(Number(v), usePersianDigits)}
                  />
                  <ReferenceLine y={25_000_000} stroke="#C84B31" strokeDasharray="4 4" />
                  <Tooltip
                    formatter={(v: unknown) => [
                      data.settings.privacyMode ? '•••••' : fmt(Number(v)),
                      'موجودی نقد پیش‌بینی‌شده',
                    ]}
                    contentStyle={{ borderRadius: '10px', border: '1px solid #EAE2D8', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#2D6A4F"
                    fill="#2D6A4F"
                    fillOpacity={0.14}
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Add Sayadi Check Form */}
            <form
              onSubmit={handleAddCheck}
              className="xl:col-span-4 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-3"
            >
              <h3 className="text-sm font-extrabold text-[#2B1E1A]">ثبت چک صیادی جدید</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChkType('issued')}
                  className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                    chkType === 'issued'
                      ? 'bg-[#FEF2F2] border-[#C84B31] text-[#991B1B]'
                      : 'bg-white border-[#EAE2D8] text-[#5A4A42]'
                  }`}
                >
                  چک پرداختی (بنکدار)
                </button>
                <button
                  type="button"
                  onClick={() => setChkType('received')}
                  className={`py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                    chkType === 'received'
                      ? 'bg-[#ECFDF5] border-[#2D6A4F] text-[#065F46]'
                      : 'bg-white border-[#EAE2D8] text-[#5A4A42]'
                  }`}
                >
                  چک دریافتی (کافه)
                </button>
              </div>
              <input
                required
                type="text"
                value={chkParty}
                onChange={(e) => setChkParty(e.target.value)}
                placeholder="نام طرف حساب (مثلاً پخش لبنیات)"
                className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
              />
              <LocaleNumberInput value={chkAmt} onChange={setChkAmt} suffix="تومان" />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={chkDate}
                  onChange={(e) => setChkDate(e.target.value)}
                  placeholder="سررسید شمسی"
                  className="rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                />
                <LocaleNumberInput value={chkDays} onChange={setChkDays} min={0} max={180} suffix="روز دیگر" />
              </div>
              <input
                type="text"
                value={chkSayadi}
                onChange={(e) => setChkSayadi(e.target.value)}
                placeholder="شناسه ۱۶ رقمی صیادی (اختیاری)"
                className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs tabular-nums"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#2B1E1A] text-white text-xs font-bold hover:bg-[#3E2D27] cursor-pointer"
              >
                ثبت در دفتر چک صیادی
              </button>
            </form>

            {/* Sayadi Checks Ledger */}
            <div className="xl:col-span-8 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-2.5">
              <h3 className="text-sm font-extrabold text-[#2B1E1A]">دفتر چک‌های صیادی در جریان</h3>
              {data.checks.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                    c.type === 'issued'
                      ? 'bg-[#FEF2F2]/50 border-[#F5C2B8]'
                      : 'bg-[#ECFDF5]/50 border-[#A7F3D0]'
                  }`}
                >
                  <div>
                    <div className="text-xs font-extrabold text-[#2B1E1A]">
                      {c.type === 'issued' ? 'پرداختی' : 'دریافتی'} — {c.counterparty}
                    </div>
                    <div className="text-[11px] text-[#6E5C54] tabular-nums mt-0.5">
                      سررسید: {c.dueDateShamsi} ({formatDigits(c.daysFromToday, usePersianDigits)} روز مانده) ·
                      شناسه صیادی: {formatDigits(c.sayadiId, usePersianDigits)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-extrabold tabular-nums ${
                        c.type === 'issued' ? 'text-[#C84B31]' : 'text-[#2D6A4F]'
                      }`}
                    >
                      <PrivacyValue>
                        {c.type === 'issued' ? '-' : '+'}
                        {fmt(c.amount, true)}
                      </PrivacyValue>
                    </span>
                    <button
                      type="button"
                      aria-label={`حذف چک ${c.counterparty}`}
                      onClick={() => deleteCheck(c.id)}
                      className="p-1.5 text-[#8C7B72] hover:text-[#C84B31] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shock_capex' && (
        <div className="space-y-5">
          <GuidedBanner text="شوک‌های تورمی بازار (مثل گرانی ۳۰٪ لبنیات یا جهش ۵۰٪ پسته) را تست کنید و با ماشین‌حساب بازگشت سرمایه قبل از خرید دستگاه تصمیم بگیرید." />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Inflation Shock Simulator */}
            <section className="xl:col-span-7 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
                  شبیه‌ساز شوک تورم کالاهای اساسی ایران
                  <HelpTip id="inflationShock" />
                </h2>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      setShocks({ butter_oil: 25, flour_sugar: 15, nuts_spice: 35, dairy_egg: 20, packaging_overhead: 15 })
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#FFFBEB] border border-[#F5D08A] font-bold text-[#92400E] cursor-pointer"
                  >
                    شوک شب عید
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setShocks({ butter_oil: 30, flour_sugar: 0, nuts_spice: 0, dairy_egg: 30, packaging_overhead: 0 })
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] font-bold cursor-pointer"
                  >
                    گرانی ۳۰٪ لبنیات و کره
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setShocks({ butter_oil: 0, flour_sugar: 0, nuts_spice: 50, dairy_egg: 0, packaging_overhead: 0 })
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] font-bold cursor-pointer"
                  >
                    جهش ۵۰٪ پسته
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setShocks({ butter_oil: 0, flour_sugar: 0, nuts_spice: 0, dairy_egg: 0, packaging_overhead: 0 })
                    }
                    className="px-2.5 py-1 rounded-lg border border-[#EAE2D8] text-[#7D6C63] cursor-pointer"
                  >
                    ریست
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {(
                  [
                    { key: 'butter_oil', label: 'کره حیوانی و روغن صاف' },
                    { key: 'nuts_spice', label: 'پسته، زعفران و مغزیجات' },
                    { key: 'dairy_egg', label: 'خامه قنادی و تخم‌مرغ' },
                    { key: 'flour_sugar', label: 'آرد نول، نخودچی و شکر' },
                    { key: 'packaging_overhead', label: 'جعبه، بسته‌بندی و سربار' },
                  ] as const
                ).map((item) => (
                  <div key={item.key} className="bg-[#FAF8F5] rounded-lg p-3 border border-[#EFE7DC]">
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span>{item.label}</span>
                      <span className="text-[#C84B31] tabular-nums">
                        +{formatDigits(shocks[item.key], usePersianDigits)}٪
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={5}
                      value={shocks[item.key]}
                      onChange={(e) =>
                        setShocks((p) => ({ ...p, [item.key]: Number(e.target.value) }))
                      }
                      className="w-full accent-[#C84B31]"
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-[#FEF2F2] border border-[#F5C2B8] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs space-y-1">
                  <div className="font-extrabold text-[#991B1B]">
                    ضربه شوک به سود ماهانه (بدون اصلاح نرخ):{' '}
                    <span className="tabular-nums">
                      <PrivacyValue>{fmt(shockSim.profitImpact, true)}</PrivacyValue>
                    </span>
                  </div>
                  <div className="text-[#7F1D1D] tabular-nums">
                    حاشیه سود منو از {formatPercent(summary.blendedNetMarginPct, usePersianDigits)} به{' '}
                    {formatPercent(shockSim.nextSummary.blendedNetMarginPct, usePersianDigits)} می‌رسد.
                  </div>
                </div>

                {shockSim.hasShock && (
                  <button
                    type="button"
                    onClick={() => {
                      const map: Record<string, number> = {};
                      shockSim.priceRecommendations.forEach((r) => {
                        map[r.recipeId] = r.newPrice;
                      });
                      bulkUpdateRecipePrices(map, 'اعمال قیمت‌های ترمیم‌شده پس از شوک تورم');
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] cursor-pointer"
                  >
                    اعمال قیمت‌های جدید (با قابلیت بازگشت)
                  </button>
                )}
              </div>
            </section>

            {/* CapEx & Hiring Payback Simulator */}
            <section className="xl:col-span-5 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
                <TrendingUp className="w-4.5 h-4.5 text-[#2D6A4F]" />
                <span>دستگاه بخرم یا کارگر استخدام کنم؟ (بازگشت سرمایه)</span>
                <HelpTip id="capexPayback" />
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">عنوان سرمایه‌گذاری یا استخدام</label>
                  <input
                    type="text"
                    value={investTitle}
                    onChange={(e) => setInvestTitle(e.target.value)}
                    className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">هزینه خرید دستگاه / سرمایه‌گذاری اولیه</label>
                  <LocaleNumberInput value={capexCost} onChange={setCapexCost} suffix="تومان" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">هزینه ثابت ماهانه جدید (حقوق/برق/نگهداری)</label>
                  <LocaleNumberInput
                    value={extraMonthlyFixedCost}
                    onChange={setExtraMonthlyFixedCost}
                    suffix="تومان"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">فروش اضافه مورد انتظار در روز (کیلوگرم)</label>
                  <LocaleNumberInput
                    value={expectedExtraDailyKg}
                    onChange={setExpectedExtraDailyKg}
                    suffix="کیلو/روز"
                  />
                </div>
              </div>

              <div
                className={`rounded-xl border p-4 space-y-2 ${
                  paybackCalc.verdict === 'go'
                    ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                    : paybackCalc.verdict === 'caution'
                    ? 'bg-[#FFFBEB] border-[#F5D08A]'
                    : 'bg-[#FEF2F2] border-[#F5C2B8]'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span className="flex items-center gap-1">
                    {paybackCalc.verdict === 'go' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#2D6A4F]" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                    )}
                    نتیجه تحلیل:
                  </span>
                  <span
                    className={
                      paybackCalc.verdict === 'go'
                        ? 'text-[#2D6A4F]'
                        : paybackCalc.verdict === 'caution'
                        ? 'text-[#B45309]'
                        : 'text-[#C84B31]'
                    }
                  >
                    {paybackCalc.verdict === 'go'
                      ? 'توجیه عالی — اقدام کنید'
                      : paybackCalc.verdict === 'caution'
                      ? 'متوسط — با احتیاط'
                      : 'فعلاً صبر کنید'}
                  </span>
                </div>
                <div className="text-xs tabular-nums space-y-1 text-[#2B1E1A]">
                  <div>
                    دوره بازگشت اصل سرمایه:{' '}
                    <strong>
                      {Number.isFinite(paybackCalc.paybackMonths)
                        ? `${formatNumber(paybackCalc.paybackMonths, {
                            decimals: 1,
                            usePersian: usePersianDigits,
                          })} ماه`
                        : 'بازگشت‌پذیر نیست'}
                    </strong>
                  </div>
                  <div>
                    حداقل فروش اضافه روزانه برای توجیه ۱ ساله:{' '}
                    <strong>
                      {formatNumber(paybackCalc.minDailyKgBreakEven, {
                        decimals: 1,
                        usePersian: usePersianDigits,
                      })}{' '}
                      کیلو در روز
                    </strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
