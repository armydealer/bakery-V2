import {
  ComputedWorkshopSummary,
  MonteCarloResult,
  OfflineInsight,
  TornadoDriver,
  WorkshopData,
} from '../types';
import { formatCurrency, formatDigits, formatPercent } from './formatters';
import { computeCashflowStressTimeline } from './costEngine';

/**
 * 100% Offline Deterministic Rule-Based CFO Strategic Advisor.
 * Zero API calls, zero internet required, grounded strictly in computed numbers.
 */
export function generateOfflineStrategicInsights(
  data: WorkshopData,
  summary: ComputedWorkshopSummary,
  monteCarlo: MonteCarloResult,
  tornado: TornadoDriver[]
): OfflineInsight[] {
  const insights: OfflineInsight[] = [];
  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number) => formatCurrency(v, currencyUnit, usePersianDigits, true);

  // 1. Real vs. Nominal Profit Capital Erosion Check
  const erosionPct =
    summary.nominalMonthlyProfit > 0
      ? (summary.inventoryReplacementReserve / summary.nominalMonthlyProfit) * 100
      : 100;
  if (summary.realSafeOwnerDraw <= 0) {
    insights.push({
      id: 'real-draw-critical',
      severity: 'critical',
      category: 'حفاظت سرمایه در گردش',
      title: 'خطر فرسایش سرمایه در گردش در تورم',
      metric: `سود قابل برداشت: ${fmt(summary.realSafeOwnerDraw)}`,
      diagnosis: `کل سود اسمی (${fmt(summary.nominalMonthlyProfit)}) صرف جبران گرانی مواد ماه بعد (${fmt(summary.inventoryReplacementReserve)}) و سپر رکود می‌شود.`,
      action: 'پیش از هر برداشت شخصی، قیمت آیتم‌های غیراتحادیه‌ای را اصلاح کنید و فروش پک‌های میکس را افزایش دهید.',
    });
  } else if (erosionPct > 28) {
    insights.push({
      id: 'real-draw-warn',
      severity: 'warning',
      category: 'سود واقعی در برابر سود کاذب',
      title: `${formatPercent(erosionPct, usePersianDigits, 0)} از سود روی کاغذ متعلق به انبار ماه بعد است`,
      metric: `ذخیره تورم انبار: ${fmt(summary.inventoryReplacementReserve)}`,
      diagnosis: 'به دلیل وزن بالای کره، پسته و شکلات در بهای تمام‌شده، تورم ماهانه بخش مهمی از سود اسمی را می‌بلعد.',
      action: `ماهانه حداکثر ${fmt(summary.realSafeOwnerDraw)} برداشت کنید و مابقی را در حساب خرید مواد نگه دارید.`,
    });
  } else {
    insights.push({
      id: 'real-draw-healthy',
      severity: 'healthy',
      category: 'سود واقعی قابل برداشت',
      title: 'تراز سود واقعی و حفاظت از انبار در وضعیت سالم است',
      metric: `برداشت امن مدیر: ${fmt(summary.realSafeOwnerDraw)}`,
      diagnosis: 'حاشیه سود منو پوشش مطمئنی روی تورم ماهانه مواد اولیه و سپر رکود فصلی ایجاد کرده است.',
      action: 'سود مازاد را برای خرید نقدی با تخفیف روی ۳ قلم اول پارتو (کره، خامه، پسته) به کار بگیرید.',
    });
  }

  // 2. Union Price Ceiling Squeeze
  const unionIssues = summary.recipeMetrics.filter(
    (r) => r.unionCeilingStatus === 'exceeded' || r.unionCeilingStatus === 'squeezed'
  );
  if (unionIssues.length > 0) {
    insights.push({
      id: 'union-ceiling',
      severity: 'warning',
      category: 'سقف نرخ اتحادیه قنادان',
      title: `${formatDigits(unionIssues.length, usePersianDigits)} محصول در ناحیه فشار یا عبور از سقف اتحادیه`,
      metric: unionIssues.map((u) => u.name).join('، '),
      diagnosis: 'در محصولات مشمول نرخ مصوب، رشد هزینه کره و جعبه حاشیه سود را فشرده کرده است.',
      action: 'برای رعایت کامل قانون اتحادیه و حفظ سود، فروش تکی این آیتم‌ها را با «پک میکس کادویی» و آیتم‌های تخصصی متعادل کنید.',
    });
  }

  // 3. SnappFood Channel Margin Leak
  const snappChannel = summary.channelSummary.find((c) => c.channel === 'snappfood');
  const storeChannel = summary.channelSummary.find((c) => c.channel === 'storefront');
  if (snappChannel && storeChannel && snappChannel.kg > 0 && snappChannel.marginPct < storeChannel.marginPct - 8) {
    insights.push({
      id: 'snappfood-leak',
      severity: 'warning',
      category: 'کانال‌های فروش آنلاین',
      title: 'افت حاشیه سود در سفارش‌های اسنپ‌فود و تپسی‌فود',
      metric: `سود اسنپ‌فود ${formatPercent(snappChannel.marginPct, usePersianDigits)} در برابر ویترین ${formatPercent(storeChannel.marginPct, usePersianDigits)}`,
      diagnosis: `کمیسیون ${formatPercent(data.settings.defaultSnappfoodCommissionPct, usePersianDigits, 0)} و هزینه جعبه پیک سود کانال آنلاین را کاهش داده است.`,
      action: 'در تب «دفاع از سود در اسنپ‌فود»، نرخ محافظت‌شده هر شیرینی را در پنل فروشنده به‌روزرسانی کنید.',
    });
  }

  // 4. Oven Bottleneck Opportunity (Theory of Constraints)
  const sortedOven = [...summary.recipeMetrics].sort((a, b) => b.profitPerOvenHour - a.profitPerOvenHour);
  if (sortedOven.length >= 2) {
    const top = sortedOven[0];
    const bottom = sortedOven[sortedOven.length - 1];
    const ovenDiagnosis =
      bottom.profitPerOvenHour > 0
        ? `هر ساعت پخت «${top.name}» حدود ${formatDigits((top.profitPerOvenHour / bottom.profitPerOvenHour).toFixed(1), usePersianDigits)} برابر «${bottom.name}» سود خالص می‌سازد.`
        : `هر ساعت پخت «${top.name}» معادل ${fmt(top.profitPerOvenHour)} سود خالص می‌سازد، در حالی که «${bottom.name}» به ازای هر ساعت فر سوددهی منفی یا نزدیک به صفر (${fmt(bottom.profitPerOvenHour)}) دارد.`;
    insights.push({
      id: 'oven-toc',
      severity: 'opportunity',
      category: 'گلوگاه فر (نظریه محدودیت‌ها)',
      title: `«${top.name}» پول‌سازترین محصول به ازای هر ساعت فر است`,
      metric: `${fmt(top.profitPerOvenHour)} / ساعت فر`,
      diagnosis: ovenDiagnosis,
      action: 'در پیک فروش آخر هفته، یلدا و اسفند، اولویت سینی‌های فر و جایگاه اول ویترین را به آیتم‌های صدر جدول ساعت فر بدهید.',
    });
  }

  // 5. Invisible Variance & Waste Alert
  if (summary.wasteBreakdown.invisibleVarianceCost > 2_000_000) {
    insights.push({
      id: 'invisible-waste',
      severity: 'critical',
      category: 'دزدگیر پرت نامرئی',
      title: 'نشتی مالی در مصرف واقعی انبار شناسایی شد',
      metric: `زیان ماهانه پرت نامرئی: ${fmt(summary.wasteBreakdown.invisibleVarianceCost)}`,
      diagnosis: 'اختلاف مصرف واقعی مواد گران‌قیمت (به‌ویژه کره و پسته) نسبت به دستور پخت تئوری قابل توجه است.',
      action: 'پیمانه‌گذاری استاندارد برای تزیین پسته و توزین روزانه کره خروجی از یخچال را با کارت پخت استادکار اجباری کنید.',
    });
  }

  // 6. Sayadi Check Liquidity Stress Check
  const stress = computeCashflowStressTimeline(data, summary);
  if (stress.dangerDays.length > 0 || monteCarlo.checkDefaultRiskPct > 10) {
    insights.push({
      id: 'sayadi-risk',
      severity: 'critical',
      category: 'نگهبان چک‌های صیادی',
      title: 'هشدار فشار نقدینگی در سررسید چک‌های پیش‌رو',
      metric: `ریسک کسری چک (مونت‌کارلو): ${formatPercent(monteCarlo.checkDefaultRiskPct, usePersianDigits)}`,
      diagnosis: `حداقل موجودی نقد در ۳۵ روز آینده به ${fmt(stress.minBalance)} می‌رسد.`,
      action: 'وصول چک دریافتی کافه‌ها را ۴۸ ساعت پیش از سررسید پیگیری کرده و از دپوی غیرضروری مواد تا پاس‌شدن چک‌ها خودداری کنید.',
    });
  }

  // 7. Top Tornado Driver
  if (tornado.length > 0) {
    const topDriver = tornado[0];
    insights.push({
      id: 'tornado-top',
      severity: 'opportunity',
      category: 'تحلیل حساسیت (تورنادو)',
      title: `حساس‌ترین اهرم سود کارگاه: ${topDriver.label}`,
      metric: `دامنه اثر ±۱۰٪: ${fmt(topDriver.totalSpread)}`,
      diagnosis: topDriver.impactDescription,
      action: 'پایش هفتگی این متغیر بیشترین بازده مدیریتی را نسبت به سایر هزینه‌های خرد دارد.',
    });
  }

  return insights;
}
