import { ComputedWorkshopSummary, TornadoDriver, WorkshopData } from '../types';
import { computeWorkshopSummary } from './costEngine';

/**
 * One-At-A-Time (OAT) ±10% Deterministic Tornado Sensitivity Engine.
 * Evaluates 7 core Iranian confectionery drivers and sorts descending by total Toman impact spread.
 */
export function runTornadoSensitivity(
  data: WorkshopData,
  baseSummary: ComputedWorkshopSummary
): TornadoDriver[] {
  const baseProfit = baseSummary.nominalMonthlyProfit;

  const evalPerturbed = (mutator: (draft: WorkshopData) => WorkshopData): number => {
    const next = mutator(data);
    return computeWorkshopSummary(next).nominalMonthlyProfit - baseProfit;
  };

  const drivers: Array<{
    key: string;
    label: string;
    impactDescription: string;
    low: (d: WorkshopData) => WorkshopData; // Unfavorable -10% profit shock
    high: (d: WorkshopData) => WorkshopData; // Favorable +10% profit shock
  }> = [
    {
      key: 'selling_price',
      label: 'قیمت فروش منو (±۱۰٪)',
      impactDescription: 'تغییر ۱۰ درصدی نرخ فروش تمام شیرینی‌ها بدون تغییر حجم فروش',
      low: (d) => ({
        ...d,
        recipes: d.recipes.map((r) => ({ ...r, sellingPricePerKg: r.sellingPricePerKg * 0.9 })),
      }),
      high: (d) => ({
        ...d,
        recipes: d.recipes.map((r) => ({ ...r, sellingPricePerKg: r.sellingPricePerKg * 1.1 })),
      }),
    },
    {
      key: 'sales_volume',
      label: 'حجم فروش ماهانه (±۱۰٪)',
      impactDescription: 'نوسان ۱۰ درصدی کیلوگرم فروش کل کارگاه در ماه',
      low: (d) => ({
        ...d,
        recipes: d.recipes.map((r) => ({ ...r, monthlySalesKg: r.monthlySalesKg * 0.9 })),
      }),
      high: (d) => ({
        ...d,
        recipes: d.recipes.map((r) => ({ ...r, monthlySalesKg: r.monthlySalesKg * 1.1 })),
      }),
    },
    {
      key: 'butter_oil',
      label: 'قیمت کره و روغن (±۱۰٪)',
      impactDescription: 'تکان ۱۰ درصدی نرخ کارتن کره حیوانی و روغن صاف قنادی',
      low: (d) => ({
        ...d,
        ingredients: d.ingredients.map((i) =>
          i.category === 'butter_oil' ? { ...i, packPrice: i.packPrice * 1.1 } : i
        ),
      }),
      high: (d) => ({
        ...d,
        ingredients: d.ingredients.map((i) =>
          i.category === 'butter_oil' ? { ...i, packPrice: i.packPrice * 0.9 } : i
        ),
      }),
    },
    {
      key: 'nuts_spice',
      label: 'قیمت پسته، زعفران و هل (±۱۰٪)',
      impactDescription: 'نوسان ۱۰ درصدی بازار مغزیجات و ادویه قنادی',
      low: (d) => ({
        ...d,
        ingredients: d.ingredients.map((i) =>
          i.category === 'nuts_spice' ? { ...i, packPrice: i.packPrice * 1.1 } : i
        ),
      }),
      high: (d) => ({
        ...d,
        ingredients: d.ingredients.map((i) =>
          i.category === 'nuts_spice' ? { ...i, packPrice: i.packPrice * 0.9 } : i
        ),
      }),
    },
    {
      key: 'overhead_payroll',
      label: 'اجاره، حقوق و سربار (±۱۰٪)',
      impactDescription: 'تغییر ۱۰ درصدی هزینه‌های ثابت، اجاره و دستمزد پرسنل',
      low: (d) => ({
        ...d,
        overheads: d.overheads.map((o) => ({ ...o, monthlyAmount: o.monthlyAmount * 1.1 })),
        staff: d.staff.map((s) => ({ ...s, baseMonthlySalary: s.baseMonthlySalary * 1.1 })),
      }),
      high: (d) => ({
        ...d,
        overheads: d.overheads.map((o) => ({ ...o, monthlyAmount: o.monthlyAmount * 0.9 })),
        staff: d.staff.map((s) => ({ ...s, baseMonthlySalary: s.baseMonthlySalary * 0.9 })),
      }),
    },
    {
      key: 'dairy_egg',
      label: 'قیمت خامه و تخم‌مرغ (±۱۰٪)',
      impactDescription: 'نوسان ۱۰ درصدی خامه قنادی و شانه تخم‌مرغ',
      low: (d) => ({
        ...d,
        ingredients: d.ingredients.map((i) =>
          i.category === 'dairy_egg' ? { ...i, packPrice: i.packPrice * 1.1 } : i
        ),
      }),
      high: (d) => ({
        ...d,
        ingredients: d.ingredients.map((i) =>
          i.category === 'dairy_egg' ? { ...i, packPrice: i.packPrice * 0.9 } : i
        ),
      }),
    },
    {
      key: 'spoilage_channel',
      label: 'ضایعات ویترین و کمیسیون (±۱۰٪)',
      impactDescription: 'تغییر نسبی ۱۰ درصدی نرخ ضایعات ماندگاری و کمیسیون اسنپ‌فود',
      low: (d) => ({
        ...d,
        settings: {
          ...d.settings,
          defaultSnappfoodCommissionPct: d.settings.defaultSnappfoodCommissionPct * 1.1,
        },
        recipes: d.recipes.map((r) => ({ ...r, shelfLifeSpoilagePct: r.shelfLifeSpoilagePct * 1.1 })),
      }),
      high: (d) => ({
        ...d,
        settings: {
          ...d.settings,
          defaultSnappfoodCommissionPct: d.settings.defaultSnappfoodCommissionPct * 0.9,
        },
        recipes: d.recipes.map((r) => ({ ...r, shelfLifeSpoilagePct: r.shelfLifeSpoilagePct * 0.9 })),
      }),
    },
  ];

  const results: TornadoDriver[] = drivers.map((drv) => {
    const lowProfitDelta = Math.round(evalPerturbed(drv.low));
    const highProfitDelta = Math.round(evalPerturbed(drv.high));
    return {
      key: drv.key,
      label: drv.label,
      lowProfitDelta,
      highProfitDelta,
      totalSpread: Math.abs(highProfitDelta - lowProfitDelta),
      impactDescription: drv.impactDescription,
    };
  });

  return results.sort((a, b) => b.totalSpread - a.totalSpread);
}
