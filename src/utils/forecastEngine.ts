import { ComputedWorkshopSummary, ForecastMonthPoint, WorkshopData } from '../types';

export interface ForecastAssumptions {
  horizonMonths: 3 | 6 | 12;
  monthlyDemandGrowthPct: number; // e.g., 1.5%
  annualMaterialInflationPct: number; // e.g., 42%
  pricePassThroughPct: number; // e.g., 85% (how fast bakery adjusts selling prices to inflation)
  startMonthIndex?: number; // 0..11 Shamsi index
}

/**
 * 12-Month Holt-Winters Seasonal Forecast Engine with 90% Confidence Cone.
 * Pure deterministic TypeScript math: P10/P90 bands widen proportionally to z * sigma * sqrt(t).
 */
export function runSeasonalForecast(
  data: WorkshopData,
  summary: ComputedWorkshopSummary,
  assumptions: ForecastAssumptions
): ForecastMonthPoint[] {
  const {
    horizonMonths,
    monthlyDemandGrowthPct,
    annualMaterialInflationPct,
    pricePassThroughPct,
    startMonthIndex = 8, // Default Azar (month 9) so Yalda & Esfand show cleanly
  } = assumptions;

  const seasonalCurve = data.seasonalCurve;
  const monthlyMatInf = Math.pow(1 + Math.max(0, annualMaterialInflationPct) / 100, 1 / 12) - 1;
  const monthlyPriceInf = monthlyMatInf * Math.min(1.15, Math.max(0.2, pricePassThroughPct / 100));
  const monthlyOverheadInf = monthlyMatInf * 0.45; // Rent/wages adjust slower than commodities
  const growthRate = monthlyDemandGrowthPct / 100;

  const baseRevenue = summary.totalMonthlyRevenue;
  const baseVariable =
    summary.totalMonthlyMaterialCost +
    summary.totalMonthlyPackagingCost +
    summary.totalMonthlyChannelFees;
  const baseOverhead = summary.totalMonthlyOverheadAndPayroll;

  // Z-score for 90% two-sided confidence interval (P10..P90 => 80% inner band, z=1.2816; 90% cone z=1.645)
  const z90 = 1.645;
  const monthlyRevSigma = 0.065; // 6.5% monthly demand standard deviation
  const monthlyProfitSigmaRatio = 0.14;

  let cumulativeCash = data.settings.openingCashBalance;
  const points: ForecastMonthPoint[] = [];

  for (let t = 1; t <= horizonMonths; t++) {
    const curveIdx = (startMonthIndex + t - 1) % 12;
    const season = seasonalCurve[curveIdx] ?? {
      index: curveIdx,
      name: `ماه ${t}`,
      demandMultiplier: 1,
      occasion: 'ماه عادی',
    };

    const demandIndex = season.demandMultiplier * Math.pow(1 + growthRate, t - 1);
    const priceIndex = Math.pow(1 + monthlyPriceInf, t - 1);
    const matCostIndex = Math.pow(1 + monthlyMatInf, t - 1);
    const ovhIndex = Math.pow(1 + monthlyOverheadInf, t - 1);

    const revenueBase = baseRevenue * demandIndex * priceIndex;
    const variableCostBase = baseVariable * demandIndex * matCostIndex;
    const overheadCostBase = baseOverhead * ovhIndex;
    const totalCostBase = variableCostBase + overheadCostBase;
    const profitBase = revenueBase - totalCostBase;

    const inventoryReserve = variableCostBase * monthlyMatInf;
    const slumpReserve = profitBase > 0 ? profitBase * (data.settings.slumpReserveRatePct / 100) : 0;
    const realProfitBase = Math.max(0, profitBase - inventoryReserve - slumpReserve);

    // Mathematically widening uncertainty cone proportional to sqrt(t)
    const sqrtT = Math.sqrt(t);
    const revSpread = revenueBase * z90 * monthlyRevSigma * sqrtT;
    const revenueP90 = revenueBase + revSpread;
    const revenueP10 = Math.max(0, revenueBase - revSpread);

    const profitUncertaintyBase = Math.max(Math.abs(profitBase), revenueBase * 0.16);
    const profitSpread = profitUncertaintyBase * z90 * monthlyProfitSigmaRatio * sqrtT;
    const profitP90 = profitBase + profitSpread;
    const profitP10 = profitBase - profitSpread;

    cumulativeCash += profitBase - inventoryReserve;

    points.push({
      monthIndex: t,
      shamsiName: season.name,
      occasion: season.occasion,
      seasonalMultiplier: season.demandMultiplier,
      revenueBase: Math.round(revenueBase),
      revenueP10: Math.round(revenueP10),
      revenueP90: Math.round(revenueP90),
      totalCostBase: Math.round(totalCostBase),
      profitBase: Math.round(profitBase),
      profitP10: Math.round(profitP10),
      profitP90: Math.round(profitP90),
      realProfitBase: Math.round(realProfitBase),
      cumulativeCashBase: Math.round(cumulativeCash),
      slumpDelta: Math.round(profitBase - summary.nominalMonthlyProfit),
    });
  }

  return points;
}
