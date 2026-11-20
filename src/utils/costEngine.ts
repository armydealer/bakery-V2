import {
  ComputedRecipeMetrics,
  ComputedWorkshopSummary,
  CustomCakePreset,
  GoalSeekPath,
  Ingredient,
  MenuQuadrant,
  MixBoxPreset,
  Recipe,
  RecipeChannelMetrics,
  RecipeLineItem,
  SalesChannelKey,
  StaffMember,
  SubRecipe,
  WorkshopData,
  WorkshopSettings,
} from '../types';
import { roundToStep, safeDiv } from './formatters';

export function getIngredientUnitCost(ing: Ingredient): number {
  return safeDiv(ing.packPrice, Math.max(0.0001, ing.packQuantityInBase), 0);
}

/**
 * Iranian Labor Law True Monthly Employer Cost:
 * Base salary * (1 + 23% employer SSO + 2/12 Eidi + 1/12 Sanavat) + monthly non-insured benefits
 */
export function computeTrueMonthlyStaffCost(staff: StaffMember): {
  baseAndBenefits: number;
  insurance23: number;
  eidiAccrual: number;
  sanavatAccrual: number;
  totalTrueCost: number;
} {
  if (!staff.active) {
    return { baseAndBenefits: 0, insurance23: 0, eidiAccrual: 0, sanavatAccrual: 0, totalTrueCost: 0 };
  }
  const base = Math.max(0, staff.baseMonthlySalary);
  const benefits = Math.max(0, staff.monthlyBenefits);
  const insurance23 = staff.includeInsurance23 ? base * 0.23 : 0;
  const eidiAccrual = staff.includeEidi ? base * (2 / 12) : 0;
  const sanavatAccrual = staff.includeSanavat ? base * (1 / 12) : 0;
  return {
    baseAndBenefits: base + benefits,
    insurance23,
    eidiAccrual,
    sanavatAccrual,
    totalTrueCost: base + benefits + insurance23 + eidiAccrual + sanavatAccrual,
  };
}

/**
 * Recursive sub-recipe unit cost (Toman per gram) with cycle protection.
 */
export function computeSubRecipeUnitCosts(
  ingredients: Ingredient[],
  subRecipes: SubRecipe[]
): Record<string, number> {
  const ingCostMap: Record<string, number> = {};
  for (const ing of ingredients) {
    ingCostMap[ing.id] = getIngredientUnitCost(ing);
  }

  const subMap = new Map<string, SubRecipe>();
  for (const sr of subRecipes) {
    subMap.set(sr.id, sr);
  }

  const memo: Record<string, number> = {};
  const visiting = new Set<string>();

  function resolveSub(id: string): number {
    if (memo[id] !== undefined) return memo[id];
    if (visiting.has(id)) return 0; // Prevent circular reference
    const sr = subMap.get(id);
    if (!sr) return 0;

    visiting.add(id);
    let totalCost = 0;
    for (const item of sr.items) {
      if (item.kind === 'ingredient') {
        totalCost += (ingCostMap[item.refId] ?? 0) * Math.max(0, item.amount);
      } else {
        totalCost += resolveSub(item.refId) * Math.max(0, item.amount);
      }
    }
    visiting.delete(id);

    const effectiveYield = Math.max(1, sr.yieldGrams);
    const unitCost = safeDiv(totalCost, effectiveYield, 0);
    memo[id] = unitCost;
    return unitCost;
  }

  for (const sr of subRecipes) {
    resolveSub(sr.id);
  }
  return memo;
}

/**
 * Computes weight in grams of a RecipeLineItem (assumes piece items like eggs weigh ~55g if needed).
 */
export function estimateItemWeightGrams(
  item: RecipeLineItem,
  ingredientMap: Map<string, Ingredient>
): number {
  const amt = Math.max(0, item.amount);
  if (item.kind === 'subRecipe') return amt;
  const ing = ingredientMap.get(item.refId);
  if (!ing) return amt;
  if (ing.baseUnit === 'gram' || ing.baseUnit === 'ml') return amt;
  // Standard Iranian medium egg ~ 55g; other piece items negligible weight
  if (ing.name.includes('تخم')) return amt * 55;
  return amt * 5;
}

/**
 * SnappFood / TapsiFood Shield Price:
 * Exact menu price required to preserve storefront net profit per kg after commission and delivery box.
 */
export function computeSnappfoodShieldPrice(
  storefrontPrice: number,
  commissionPct: number,
  extraBoxCost: number,
  posFeePct: number,
  roundingStep: number
): number {
  const comm = Math.min(0.65, Math.max(0, commissionPct / 100));
  const pos = Math.min(0.1, Math.max(0, posFeePct / 100));
  const storefrontNet = storefrontPrice * (1 - pos);
  const rawShield = safeDiv(storefrontNet + Math.max(0, extraBoxCost), 1 - comm, storefrontPrice);
  return roundToStep(rawShield, roundingStep);
}

/**
 * Discount Trap math: Required volume increase % to maintain identical total gross profit after giving a discount.
 */
export function computeDiscountRequiredVolumeIncreasePct(
  currentMarginPct: number,
  discountPct: number
): { requiredVolumeIncreasePct: number; impossible: boolean } {
  const m = currentMarginPct / 100;
  const d = discountPct / 100;
  if (d <= 0) return { requiredVolumeIncreasePct: 0, impossible: false };
  if (d >= m) return { requiredVolumeIncreasePct: Infinity, impossible: true };
  const inc = (d / (m - d)) * 100;
  return { requiredVolumeIncreasePct: inc, impossible: false };
}

/**
 * Stockpile Arbitrage ("دپو کنم یا نه؟"):
 * Evaluates expected material inflation gain vs. monthly capital cost and storage/spoilage risk.
 */
export function computeStockpileArbitrage(params: {
  purchaseAmountToman: number;
  expectedPriceJumpPct: number;
  holdingMonths: number;
  monthlyCapitalCostPct: number;
  spoilageRiskPct: number;
}) {
  const { purchaseAmountToman, expectedPriceJumpPct, holdingMonths, monthlyCapitalCostPct, spoilageRiskPct } = params;
  const amount = Math.max(0, purchaseAmountToman);
  const months = Math.max(0.25, holdingMonths);
  const inflationGain = amount * (expectedPriceJumpPct / 100);
  const capitalCost = amount * (monthlyCapitalCostPct / 100) * months;
  const spoilageCost = amount * (spoilageRiskPct / 100);
  const netBenefit = inflationGain - capitalCost - spoilageCost;
  const roiPct = safeDiv(netBenefit, amount, 0) * 100;
  const optimalMaxMonths =
    monthlyCapitalCostPct > 0
      ? Math.max(0, (expectedPriceJumpPct - spoilageRiskPct) / monthlyCapitalCostPct)
      : months;

  return {
    inflationGain,
    capitalCost,
    spoilageCost,
    netBenefit,
    roiPct,
    optimalMaxMonths,
    verdict: netBenefit > 0 ? ('stockpile' as const) : ('skip' as const),
  };
}

/**
 * Cash Discount vs. Sayadi Check Arbitrage ("نقد بخرم با تخفیف یا چکی ۶۰ روزه؟"):
 */
export function computeCashVsCheckArbitrage(params: {
  invoiceAmountToman: number;
  cashDiscountPct: number;
  checkDays: number;
  monthlyCapitalCostPct: number;
}) {
  const { invoiceAmountToman, cashDiscountPct, checkDays, monthlyCapitalCostPct } = params;
  const amount = Math.max(0, invoiceAmountToman);
  const cashSaved = amount * (cashDiscountPct / 100);
  const netCashOutflow = amount - cashSaved;
  const months = Math.max(0, checkDays) / 30;
  // Value of keeping netCashOutflow working in the business / inflation hedge during check duration
  const timeValueOfMoney = netCashOutflow * (monthlyCapitalCostPct / 100) * months;
  const netCashAdvantage = cashSaved - timeValueOfMoney;
  const breakEvenDiscountPct =
    safeDiv((monthlyCapitalCostPct / 100) * months, 1 + (monthlyCapitalCostPct / 100) * months, 0) * 100;

  return {
    cashSaved,
    timeValueOfMoney,
    netCashAdvantage,
    breakEvenDiscountPct,
    verdict: netCashAdvantage >= 0 ? ('buy_cash' as const) : ('buy_check' as const),
  };
}

/**
 * Flattens all ingredient amounts required for 1 batch of a recipe (recursively resolving sub-recipes).
 */
export function flattenRecipeIngredientUsage(
  items: RecipeLineItem[],
  subRecipeMap: Map<string, SubRecipe>,
  multiplier = 1,
  acc: Record<string, number> = {},
  depth = 0
): Record<string, number> {
  if (depth > 6) return acc;
  for (const item of items) {
    const scaled = Math.max(0, item.amount) * multiplier;
    if (item.kind === 'ingredient') {
      acc[item.refId] = (acc[item.refId] ?? 0) + scaled;
    } else {
      const sr = subRecipeMap.get(item.refId);
      if (sr && sr.yieldGrams > 0) {
        const subRatio = scaled / sr.yieldGrams;
        flattenRecipeIngredientUsage(sr.items, subRecipeMap, subRatio, acc, depth + 1);
      }
    }
  }
  return acc;
}

/**
 * Core Unified Workshop Financial Engine — 100% deterministic, zero-AI.
 */
export function computeWorkshopSummary(data: WorkshopData): ComputedWorkshopSummary {
  const { settings, ingredients, subRecipes, recipes, staff, overheads, varianceRecords } = data;
  const ingMap = new Map(ingredients.map((i) => [i.id, i]));
  const subMap = new Map(subRecipes.map((s) => [s.id, s]));

  const ingredientUnitCosts: Record<string, number> = {};
  for (const ing of ingredients) {
    ingredientUnitCosts[ing.id] = getIngredientUnitCost(ing);
  }
  const subRecipeUnitCosts = computeSubRecipeUnitCosts(ingredients, subRecipes);

  // Staff & Iranian Labor Law Accruals
  let totalMonthlyStaffCost = 0;
  let totalMonthlyBasePayroll = 0;
  let totalMonthlyLaborLawAccruals = 0;
  for (const s of staff) {
    const res = computeTrueMonthlyStaffCost(s);
    totalMonthlyStaffCost += res.totalTrueCost;
    totalMonthlyBasePayroll += res.baseAndBenefits;
    totalMonthlyLaborLawAccruals += res.insurance23 + res.eidiAccrual + res.sanavatAccrual;
  }

  const totalMonthlyFixedOverhead = overheads
    .filter((o) => o.active)
    .reduce((sum, o) => sum + Math.max(0, o.monthlyAmount), 0);

  const totalMonthlyOverheadAndPayroll = totalMonthlyStaffCost + totalMonthlyFixedOverhead;

  // First pass: calculate batch yields, weights, times, and direct costs per recipe
  interface PrelimRecipe {
    recipe: Recipe;
    rawBatchWeightGrams: number;
    postBakeGrams: number;
    netYieldGrams: number;
    netYieldKg: number;
    batchMaterialCost: number;
    materialCostPerKg: number;
    spoilageAdjustedMaterialCostPerKg: number;
    spoilageCostPerKg: number;
    trimWasteCostPerKg: number;
    bakingShrinkageCostPerKg: number;
    boxAndPackagingPerKg: number;
    ovenHoursPerKg: number;
    laborHoursPerKg: number;
    monthlyOvenHours: number;
    monthlyLaborHours: number;
    monthlyActivityUnits: number;
  }

  const prelims: PrelimRecipe[] = recipes.map((recipe) => {
    let rawBatchWeightGrams = 0;
    let batchMaterialCost = 0;

    for (const item of recipe.items) {
      rawBatchWeightGrams += estimateItemWeightGrams(item, ingMap);
      if (item.kind === 'ingredient') {
        batchMaterialCost += (ingredientUnitCosts[item.refId] ?? 0) * Math.max(0, item.amount);
      } else {
        batchMaterialCost += (subRecipeUnitCosts[item.refId] ?? 0) * Math.max(0, item.amount);
      }
    }

    const safeRawGrams = Math.max(1, rawBatchWeightGrams);
    const bakingFactor = Math.max(0.25, 1 + recipe.bakingChangePct / 100);
    const postBakeGrams = safeRawGrams * bakingFactor;
    const trimFactor = Math.max(0.5, 1 - Math.max(0, recipe.trimWastePct) / 100);
    const netYieldGrams = Math.max(1, postBakeGrams * trimFactor);
    const netYieldKg = netYieldGrams / 1000;

    const rawCostPerKg = safeDiv(batchMaterialCost, safeRawGrams / 1000, 0);
    const postBakeCostPerKg = safeDiv(batchMaterialCost, postBakeGrams / 1000, 0);
    const materialCostPerKg = safeDiv(batchMaterialCost, netYieldKg, 0);

    const bakingShrinkageCostPerKg = Math.max(0, postBakeCostPerKg - rawCostPerKg);
    const trimWasteCostPerKg = Math.max(0, materialCostPerKg - postBakeCostPerKg);

    const spoilageRatio = Math.min(0.6, Math.max(0, recipe.shelfLifeSpoilagePct / 100));
    const spoilageAdjustedMaterialCostPerKg = safeDiv(materialCostPerKg, 1 - spoilageRatio, materialCostPerKg);
    const spoilageCostPerKg = Math.max(0, spoilageAdjustedMaterialCostPerKg - materialCostPerKg);

    const boxCost = settings.enforceBoxWeightDeduction ? ingredientUnitCosts[recipe.boxIngredientId] ?? 0 : 0;
    const boxAndPackagingPerKg = boxCost + Math.max(0, recipe.extraPackagingCostPerKg);

    // Effective oven hours accounting for trays per batch vs trays per oven
    const trayShare = Math.min(1, safeDiv(Math.max(1, recipe.ovenTraysPerBatch), Math.max(1, settings.traysPerOven), 0.5));
    const batchOvenHours = (Math.max(1, recipe.ovenMinutesPerBatch) / 60) * Math.max(0.2, trayShare);
    const ovenHoursPerKg = safeDiv(batchOvenHours, netYieldKg, 0.05);

    const batchLaborHours = Math.max(1, recipe.directLaborMinutesPerBatch) / 60;
    const laborHoursPerKg = safeDiv(batchLaborHours, netYieldKg, 0.05);

    const monthlySalesKg = Math.max(0, recipe.monthlySalesKg);
    const monthlyOvenHours = ovenHoursPerKg * monthlySalesKg;
    const monthlyLaborHours = laborHoursPerKg * monthlySalesKg;
    const monthlyActivityUnits = monthlyOvenHours * 0.55 + monthlyLaborHours * 0.45;

    return {
      recipe,
      rawBatchWeightGrams: safeRawGrams,
      postBakeGrams,
      netYieldGrams,
      netYieldKg,
      batchMaterialCost,
      materialCostPerKg,
      spoilageAdjustedMaterialCostPerKg,
      spoilageCostPerKg,
      trimWasteCostPerKg,
      bakingShrinkageCostPerKg,
      boxAndPackagingPerKg,
      ovenHoursPerKg,
      laborHoursPerKg,
      monthlyOvenHours,
      monthlyLaborHours,
      monthlyActivityUnits,
    };
  });

  const totalMonthlySalesKg = prelims.reduce((s, p) => s + Math.max(0, p.recipe.monthlySalesKg), 0);
  const totalActivityUnits = prelims.reduce((s, p) => s + p.monthlyActivityUnits, 0);

  // Second pass: allocate overhead and compute multi-channel economics
  const vatFactor = settings.vatEnabled ? 1 + settings.vatRatePct / 100 : 1;
  const posRate = Math.max(0, settings.defaultPosFeePct) / 100;
  const snappCommRate = Math.max(0, settings.defaultSnappfoodCommissionPct) / 100;

  const recipeMetricsDraft: ComputedRecipeMetrics[] = prelims.map((p) => {
    const r = p.recipe;
    const weightShare = safeDiv(r.monthlySalesKg, totalMonthlySalesKg, 0);
    const timeShare = safeDiv(p.monthlyActivityUnits, totalActivityUnits, 0);

    let overheadShare = weightShare;
    if (settings.overheadAllocationMethod === 'time_abc') {
      overheadShare = timeShare;
    } else if (settings.overheadAllocationMethod === 'hybrid') {
      overheadShare = weightShare * 0.5 + timeShare * 0.5;
    }

    const monthlyOverheadCost =
      r.monthlySalesKg > 0 ? totalMonthlyOverheadAndPayroll * overheadShare : 0;
    const allocatedOverheadPerKg =
      r.monthlySalesKg > 0
        ? safeDiv(monthlyOverheadCost, r.monthlySalesKg, 0)
        : safeDiv(totalMonthlyOverheadAndPayroll, Math.max(100, totalMonthlySalesKg || 500), 0);

    const totalCostPerKg =
      p.spoilageAdjustedMaterialCostPerKg + p.boxAndPackagingPerKg + allocatedOverheadPerKg;

    // Normalize channel mix
    const mixSum =
      Math.max(0, r.channelMix.storefrontPct) +
      Math.max(0, r.channelMix.cafeB2BPct) +
      Math.max(0, r.channelMix.snappfoodPct) +
      Math.max(0, r.channelMix.customEventPct);

    const normMix =
      mixSum > 0
        ? {
            storefront: r.channelMix.storefrontPct / mixSum,
            cafeB2B: r.channelMix.cafeB2BPct / mixSum,
            snappfood: r.channelMix.snappfoodPct / mixSum,
            customEvent: r.channelMix.customEventPct / mixSum,
          }
        : { storefront: 1, cafeB2B: 0, snappfood: 0, customEvent: 0 };

    const storefrontPrice = Math.max(0, r.sellingPricePerKg);
    const cafePrice = storefrontPrice * (1 - Math.max(0, r.cafeDiscountPct) / 100);
    const snappPrice = storefrontPrice * (1 + Math.max(0, r.snappfoodMarkupPct) / 100);
    const eventPrice = storefrontPrice * 1.08; // Custom event premium

    const buildChannel = (
      channel: SalesChannelKey,
      label: string,
      grossPrice: number,
      feeRate: number,
      extraBox: number,
      share: number
    ): RecipeChannelMetrics => {
      const exVatPrice = safeDiv(grossPrice, vatFactor, grossPrice);
      const fee = exVatPrice * feeRate;
      const netRev = exVatPrice - fee - extraBox;
      const netProfit = netRev - totalCostPerKg;
      const margin = safeDiv(netProfit, exVatPrice, 0) * 100;
      return {
        channel,
        label,
        effectivePricePerKg: grossPrice,
        commissionAndFeePerKg: fee,
        extraBoxPerKg: extraBox,
        netRevenuePerKg: netRev,
        netProfitPerKg: netProfit,
        netMarginPct: margin,
        monthlyKg: r.monthlySalesKg * share,
      };
    };

    const channels: RecipeChannelMetrics[] = [
      buildChannel('storefront', 'فروش ویترین', storefrontPrice, posRate, 0, normMix.storefront),
      buildChannel('cafeB2B', 'پخش کافه و هتل (B2B)', cafePrice, 0.002, 0, normMix.cafeB2B),
      buildChannel(
        'snappfood',
        'اسنپ‌فود / تپسی‌فود',
        snappPrice,
        snappCommRate,
        settings.snappfoodExtraBoxCost,
        normMix.snappfood
      ),
      buildChannel('customEvent', 'سفارشات مجالس', eventPrice, posRate, 6000, normMix.customEvent),
    ];

    const blendedGrossPricePerKg =
      storefrontPrice * normMix.storefront +
      cafePrice * normMix.cafeB2B +
      snappPrice * normMix.snappfood +
      eventPrice * normMix.customEvent;

    const blendedNetPricePerKg =
      channels[0].netRevenuePerKg * normMix.storefront +
      channels[1].netRevenuePerKg * normMix.cafeB2B +
      channels[2].netRevenuePerKg * normMix.snappfood +
      channels[3].netRevenuePerKg * normMix.customEvent;

    const blendedChannelCostPerKg = Math.max(0, blendedGrossPricePerKg - blendedNetPricePerKg);
    const netProfitPerKg = blendedNetPricePerKg - totalCostPerKg;
    const netMarginPct = safeDiv(netProfitPerKg, blendedGrossPricePerKg, 0) * 100;

    const monthlyRevenue = blendedGrossPricePerKg * r.monthlySalesKg;
    const monthlyMaterialCost = p.spoilageAdjustedMaterialCostPerKg * r.monthlySalesKg;
    const monthlyPackagingCost = p.boxAndPackagingPerKg * r.monthlySalesKg;
    const monthlyChannelFeeCost = blendedChannelCostPerKg * r.monthlySalesKg;
    const monthlyNetProfit = netProfitPerKg * r.monthlySalesKg;

    const profitPerOvenHour = safeDiv(netProfitPerKg, p.ovenHoursPerKg, 0);
    const profitPerLaborHour = safeDiv(netProfitPerKg, p.laborHoursPerKg, 0);

    // 3-Tier Rounded Pricing Recommender
    const targetM = Math.min(0.75, Math.max(0.15, settings.targetNetMarginPct / 100));
    const economyRaw = safeDiv(totalCostPerKg, 1 - Math.max(0.18, targetM - 0.1), totalCostPerKg * 1.3) * vatFactor;
    const standardRaw = safeDiv(totalCostPerKg, 1 - targetM, totalCostPerKg * 1.55) * vatFactor;
    const luxuryRaw = safeDiv(totalCostPerKg, 1 - Math.min(0.78, targetM + 0.12), totalCostPerKg * 1.9) * vatFactor;

    const recommendedPrices = {
      economy: roundToStep(economyRaw, settings.priceRoundingStep),
      standard: roundToStep(standardRaw, settings.priceRoundingStep),
      luxury: roundToStep(luxuryRaw, settings.priceRoundingStep),
    };

    const snappfoodShieldPrice = computeSnappfoodShieldPrice(
      storefrontPrice,
      settings.defaultSnappfoodCommissionPct,
      settings.snappfoodExtraBoxCost,
      settings.defaultPosFeePct,
      settings.priceRoundingStep
    );

    // End-of-day recovery floor price = direct material + packaging (zero overhead)
    const endOfDayFloorPrice = roundToStep(
      (p.materialCostPerKg + p.boxAndPackagingPerKg) * 1.05,
      5000
    );

    // Union ceiling compliance check
    let unionCeilingStatus: ComputedRecipeMetrics['unionCeilingStatus'] = 'none';
    let unionMarginGap = 0;
    if (r.unionPriceCeiling && r.unionPriceCeiling > 0) {
      const marginAtCeiling = safeDiv(r.unionPriceCeiling - totalCostPerKg, r.unionPriceCeiling, 0) * 100;
      unionMarginGap = marginAtCeiling - settings.redFlagMarginPct;
      if (storefrontPrice > r.unionPriceCeiling) {
        unionCeilingStatus = 'exceeded';
      } else if (marginAtCeiling < settings.redFlagMarginPct + 5) {
        unionCeilingStatus = 'squeezed';
      } else {
        unionCeilingStatus = 'compliant';
      }
    }

    return {
      recipeId: r.id,
      name: r.name,
      category: r.category,
      rawBatchWeightGrams: p.rawBatchWeightGrams,
      netYieldGrams: p.netYieldGrams,
      netYieldKg: p.netYieldKg,
      batchMaterialCost: p.batchMaterialCost,
      materialCostPerKg: p.materialCostPerKg,
      spoilageAdjustedMaterialCostPerKg: p.spoilageAdjustedMaterialCostPerKg,
      spoilageCostPerKg: p.spoilageCostPerKg,
      trimWasteCostPerKg: p.trimWasteCostPerKg,
      boxAndPackagingPerKg: p.boxAndPackagingPerKg,
      allocatedOverheadPerKg,
      totalCostPerKg,
      storefrontPricePerKg: storefrontPrice,
      blendedNetPricePerKg,
      blendedChannelCostPerKg,
      netProfitPerKg,
      netMarginPct,
      monthlySalesKg: r.monthlySalesKg,
      monthlyRevenue,
      monthlyMaterialCost,
      monthlyPackagingCost,
      monthlyOverheadCost,
      monthlyChannelFeeCost,
      monthlyNetProfit,
      ovenHoursPerKg: p.ovenHoursPerKg,
      monthlyOvenHours: p.monthlyOvenHours,
      profitPerOvenHour,
      laborHoursPerKg: p.laborHoursPerKg,
      profitPerLaborHour,
      recommendedPrices,
      snappfoodShieldPrice,
      endOfDayFloorPrice,
      unionCeilingStatus,
      unionMarginGap,
      quadrant: 'star' as MenuQuadrant, // Assigned below
      channels,
    };
  });

  // Assign Menu Engineering 4-Quadrants based on average sales kg & average profit/kg
  const avgSalesKg = safeDiv(
    recipeMetricsDraft.reduce((s, r) => s + r.monthlySalesKg, 0),
    Math.max(1, recipeMetricsDraft.length),
    0
  );
  const avgProfitPerKg = safeDiv(
    recipeMetricsDraft.reduce((s, r) => s + r.netProfitPerKg, 0),
    Math.max(1, recipeMetricsDraft.length),
    0
  );

  const recipeMetrics = recipeMetricsDraft.map((rm) => {
    const highPop = rm.monthlySalesKg >= avgSalesKg;
    const highProf = rm.netProfitPerKg >= avgProfitPerKg;
    let quadrant: MenuQuadrant = 'dog';
    if (highPop && highProf) quadrant = 'star';
    else if (highPop && !highProf) quadrant = 'plowhorse';
    else if (!highPop && highProf) quadrant = 'puzzle';
    return { ...rm, quadrant };
  });

  // Aggregate workshop totals
  const totalMonthlyRevenue = recipeMetrics.reduce((s, r) => s + r.monthlyRevenue, 0);
  const totalMonthlyMaterialCost = recipeMetrics.reduce((s, r) => s + r.monthlyMaterialCost, 0);
  const totalMonthlyPackagingCost = recipeMetrics.reduce((s, r) => s + r.monthlyPackagingCost, 0);
  const totalMonthlyChannelFees = recipeMetrics.reduce((s, r) => s + r.monthlyChannelFeeCost, 0);

  const totalVariableCost =
    totalMonthlyMaterialCost + totalMonthlyPackagingCost + totalMonthlyChannelFees;

  const nominalMonthlyProfit =
    totalMonthlyRevenue - totalVariableCost - totalMonthlyOverheadAndPayroll;

  // Monthly ingredient spend & Pareto 80/20 + weighted material inflation
  const monthlyUsageByIngredient: Record<string, number> = {};
  for (let idx = 0; idx < recipes.length; idx++) {
    const r = recipes[idx];
    const p = prelims[idx];
    if (!p || r.monthlySalesKg <= 0) continue;
    const spoilageFactor = safeDiv(1, 1 - Math.min(0.6, Math.max(0, r.shelfLifeSpoilagePct / 100)), 1);
    const batchesPerMonth = safeDiv(r.monthlySalesKg * spoilageFactor, p.netYieldKg, 0);
    flattenRecipeIngredientUsage(r.items, subMap, batchesPerMonth, monthlyUsageByIngredient);
    if (settings.enforceBoxWeightDeduction && r.boxIngredientId) {
      monthlyUsageByIngredient[r.boxIngredientId] =
        (monthlyUsageByIngredient[r.boxIngredientId] ?? 0) + r.monthlySalesKg;
    }
  }

  let totalTrackedMaterialSpend = 0;
  let weightedInflationNumerator = 0;
  const spendRows: Array<{ ingredientId: string; name: string; monthlySpend: number }> = [];

  for (const ing of ingredients) {
    const used = monthlyUsageByIngredient[ing.id] ?? 0;
    const spend = used * (ingredientUnitCosts[ing.id] ?? 0);
    if (spend > 0) {
      spendRows.push({ ingredientId: ing.id, name: ing.name, monthlySpend: spend });
      totalTrackedMaterialSpend += spend;
      weightedInflationNumerator += spend * Math.max(0, ing.monthlyInflationPct);
    }
  }

  spendRows.sort((a, b) => b.monthlySpend - a.monthlySpend);
  let runningCum = 0;
  const paretoIngredients = spendRows.map((row) => {
    const sharePct = safeDiv(row.monthlySpend, totalTrackedMaterialSpend, 0) * 100;
    runningCum += sharePct;
    return {
      ...row,
      sharePct,
      cumulativePct: Math.min(100, runningCum),
    };
  });

  const defaultMonthlyInf = settings.defaultAnnualInflationPct / 12;
  const weightedMaterialInflationPct =
    totalTrackedMaterialSpend > 0
      ? safeDiv(weightedInflationNumerator, totalTrackedMaterialSpend, defaultMonthlyInf)
      : defaultMonthlyInf;

  // Real vs. Nominal Profit (Inflation-Adjusted Working Capital Protection)
  const inventoryReplacementReserve =
    (totalMonthlyMaterialCost + totalMonthlyPackagingCost) * (weightedMaterialInflationPct / 100);
  const monthlySlumpReserve =
    nominalMonthlyProfit > 0 ? nominalMonthlyProfit * (settings.slumpReserveRatePct / 100) : 0;
  const realSafeOwnerDraw = Math.max(
    0,
    nominalMonthlyProfit - inventoryReplacementReserve - monthlySlumpReserve
  );

  const blendedNetMarginPct = safeDiv(nominalMonthlyProfit, totalMonthlyRevenue, 0) * 100;
  const contributionMarginRatio = Math.max(
    0.05,
    safeDiv(totalMonthlyRevenue - totalVariableCost, totalMonthlyRevenue, 0.35)
  );

  const breakEvenRevenue = safeDiv(totalMonthlyOverheadAndPayroll, contributionMarginRatio, 0);
  const avgSellingPricePerKg = safeDiv(totalMonthlyRevenue, totalMonthlySalesKg, 450000);
  const breakEvenKg = safeDiv(breakEvenRevenue, avgSellingPricePerKg, 0);
  const activeDays = Math.max(1, settings.activeWorkingDaysPerMonth);
  const dailyBreakEvenRevenue = safeDiv(breakEvenRevenue, activeDays, 0);
  const breakEvenDayOfMonth =
    totalMonthlyRevenue > 0
      ? Math.min(activeDays + 5, Math.ceil(safeDiv(breakEvenRevenue, totalMonthlyRevenue, 1) * activeDays))
      : activeDays;

  // Oven Utilization
  const monthlyOvenCapacityHours =
    Math.max(1, settings.ovenCount) * Math.max(1, settings.dailyWorkingHours) * activeDays;
  const usedOvenHours = recipeMetrics.reduce((s, r) => s + r.monthlyOvenHours, 0);
  const ovenUtilizationPct = safeDiv(usedOvenHours, monthlyOvenCapacityHours, 0) * 100;

  // Channel Summary
  const channelKeys: Array<{ key: SalesChannelKey; label: string }> = [
    { key: 'storefront', label: 'فروش ویترین' },
    { key: 'cafeB2B', label: 'پخش کافه و هتل' },
    { key: 'snappfood', label: 'اسنپ‌فود / تپسی‌فود' },
    { key: 'customEvent', label: 'سفارشات مجالس' },
  ];

  const channelSummary = channelKeys.map(({ key, label }) => {
    let revenue = 0;
    let netProfit = 0;
    let kg = 0;
    for (const rm of recipeMetrics) {
      const ch = rm.channels.find((c) => c.channel === key);
      if (ch) {
        revenue += ch.effectivePricePerKg * ch.monthlyKg;
        netProfit += ch.netProfitPerKg * ch.monthlyKg;
        kg += ch.monthlyKg;
      }
    }
    return {
      channel: key,
      label,
      revenue,
      netProfit,
      marginPct: safeDiv(netProfit, revenue, 0) * 100,
      kg,
    };
  });

  // Waste & Spoilage Breakdown
  let bakingShrinkageCost = 0;
  let trimWasteCost = 0;
  let shelfLifeSpoilageCost = 0;
  for (let i = 0; i < prelims.length; i++) {
    const p = prelims[i];
    const kg = Math.max(0, p.recipe.monthlySalesKg);
    bakingShrinkageCost += p.bakingShrinkageCostPerKg * kg;
    trimWasteCost += p.trimWasteCostPerKg * kg;
    shelfLifeSpoilageCost += p.spoilageCostPerKg * kg;
  }

  // Invisible variance loss annualized to 30-day month
  let invisibleVarianceCost = 0;
  for (const rec of varianceRecords) {
    const monthlyTheoretical = monthlyUsageByIngredient[rec.ingredientId] ?? 0;
    const periodTheoretical = monthlyTheoretical * safeDiv(rec.periodDays, 30, 7 / 30);
    const excessBase = Math.max(0, rec.actualUsedInBase - periodTheoretical);
    const monthlyExcess = excessBase * safeDiv(30, Math.max(1, rec.periodDays), 1);
    invisibleVarianceCost += monthlyExcess * (ingredientUnitCosts[rec.ingredientId] ?? 0);
  }

  const wasteBreakdown = {
    bakingShrinkageCost,
    trimWasteCost,
    shelfLifeSpoilageCost,
    invisibleVarianceCost,
    totalWasteCost:
      bakingShrinkageCost + trimWasteCost + shelfLifeSpoilageCost + invisibleVarianceCost,
  };

  // Workshop Financial Health Score (0..100)
  const marginScore = Math.min(35, Math.max(0, safeDiv(blendedNetMarginPct, settings.targetNetMarginPct, 0) * 35));
  const realDrawRatio = safeDiv(realSafeOwnerDraw, Math.max(1, nominalMonthlyProfit), 0);
  const realProfitScore = nominalMonthlyProfit > 0 ? Math.min(25, Math.max(0, realDrawRatio * 30)) : 0;
  const breakEvenScore = Math.min(20, Math.max(0, (1 - safeDiv(breakEvenDayOfMonth, activeDays, 1)) * 40));
  const capacityScore =
    ovenUtilizationPct >= 40 && ovenUtilizationPct <= 88
      ? 20
      : ovenUtilizationPct > 88
      ? Math.max(8, 20 - (ovenUtilizationPct - 88) * 0.5)
      : Math.max(5, (ovenUtilizationPct / 40) * 20);

  const healthScore =
    recipes.length === 0
      ? 25
      : Math.round(Math.min(100, Math.max(0, marginScore + realProfitScore + breakEvenScore + capacityScore)));

  let masteryRank: ComputedWorkshopSummary['masteryRank'] = 'کارگاه نوپا';
  if (healthScore >= 85) masteryRank = 'استاد بهایابی';
  else if (healthScore >= 70) masteryRank = 'کارگاه سودآور';
  else if (healthScore >= 50) masteryRank = 'قنادی تراز';

  return {
    recipeMetrics,
    subRecipeUnitCosts,
    ingredientUnitCosts,
    totalMonthlyRevenue,
    totalMonthlyMaterialCost,
    totalMonthlyPackagingCost,
    totalMonthlyChannelFees,
    totalMonthlyStaffCost,
    totalMonthlyBasePayroll,
    totalMonthlyLaborLawAccruals,
    totalMonthlyFixedOverhead,
    totalMonthlyOverheadAndPayroll,
    totalMonthlySalesKg,
    nominalMonthlyProfit,
    weightedMaterialInflationPct,
    inventoryReplacementReserve,
    monthlySlumpReserve,
    realSafeOwnerDraw,
    blendedNetMarginPct,
    contributionMarginRatio,
    breakEvenRevenue,
    breakEvenKg,
    breakEvenDayOfMonth,
    dailyBreakEvenRevenue,
    monthlyOvenCapacityHours,
    usedOvenHours,
    ovenUtilizationPct,
    healthScore,
    masteryRank,
    paretoIngredients,
    channelSummary,
    wasteBreakdown,
  };
}

/**
 * Deterministic Goal-Seek Reverse Solver ("مهندسی معکوس سود دلخواه"):
 * Computes 3 actionable mathematical paths to hit target monthly Real Safe Owner Draw.
 */
export function solveGoalSeekPaths(
  summary: ComputedWorkshopSummary,
  targetRealDraw: number,
  settings: WorkshopSettings
): GoalSeekPath[] {
  const currentReal = summary.realSafeOwnerDraw;
  const gapReal = targetRealDraw - currentReal;
  const slumpFactor = Math.max(0.4, 1 - settings.slumpReserveRatePct / 100);
  // Required additional nominal profit before slump reserve
  const gapNominal = Math.max(0, safeDiv(gapReal, slumpFactor, 0));

  if (gapReal <= 0) {
    return [
      {
        id: 'achieved',
        title: 'هدف سود واقعی محقق شده است',
        subtitle: 'کارگاه شما همین حالا بالاتر از هدف برداشت امن ماهانه قرار دارد.',
        metricBadge: 'وضعیت امن',
        feasibility: 'بالا',
        steps: [
          'سود مازاد را به صندوق سپر رکود تابستان و خرید نقدی تخفیف‌دار کره/پسته اختصاص دهید.',
          'کیفیت و ثبات طعم ستاره‌های ویترین را با کارت پخت استاندارد حفظ کنید.',
        ],
      },
    ];
  }

  const activeDays = Math.max(1, settings.activeWorkingDaysPerMonth);
  const avgProfitPerKg = Math.max(
    50000,
    safeDiv(summary.totalMonthlyRevenue - summary.totalMonthlyMaterialCost - summary.totalMonthlyPackagingCost - summary.totalMonthlyChannelFees, Math.max(1, summary.totalMonthlySalesKg), 150000)
  );
  const extraMonthlyKg = safeDiv(gapNominal, avgProfitPerKg, 0);
  const extraDailyKg = extraMonthlyKg / activeDays;

  const avgPriceIncreasePct =
    summary.totalMonthlyRevenue > 0 ? safeDiv(gapNominal, summary.totalMonthlyRevenue, 0) * 100 : 0;

  const plowhorses = summary.recipeMetrics.filter((r) => r.quadrant === 'plowhorse' || r.netMarginPct < settings.targetNetMarginPct);
  const plowhorseNames = plowhorses.slice(0, 2).map((p) => p.name).join(' و ') || 'آیتم‌های پرفروش ویترین';

  // Hybrid golden path: 40% price optimization + 35% volume growth + 25% waste/spoilage cut
  const hybridPricePct = avgPriceIncreasePct * 0.4;
  const hybridDailyKg = extraDailyKg * 0.35;
  const hybridWasteSave = gapNominal * 0.25;

  return [
    {
      id: 'volume-path',
      title: 'مسیر ۱: رشد فروش روزانه (بدون افزایش قیمت)',
      subtitle: 'افزایش حجم فروش از طریق ویترین، پک میکس و جذب کافه جدید',
      metricBadge: `+${extraDailyKg.toFixed(1)} کیلو در روز`,
      feasibility: extraDailyKg <= 8 ? 'بالا' : extraDailyKg <= 16 ? 'متوسط' : 'چالشی',
      steps: [
        `فروش روزانه را به طور میانگین ${extraDailyKg.toFixed(1)} کیلوگرم (معادل ${Math.round(extraMonthlyKg)} کیلو در ماه) افزایش دهید.`,
        'تمرکز تولید را روی آیتم‌های با بالاترین «سود در ساعت فر» بگذارید تا گلوگاه فر پر نشود.',
      ],
    },
    {
      id: 'price-path',
      title: 'مسیر ۲: اصلاح هوشمند قیمت اسب‌های کاری',
      subtitle: 'ترمیم حاشیه سود آیتم‌های پرفروش و محافظت از قیمت اسنپ‌فود',
      metricBadge: `+${avgPriceIncreasePct.toFixed(1)}٪ اصلاح نرخ`,
      feasibility: avgPriceIncreasePct <= 8 ? 'بالا' : avgPriceIncreasePct <= 15 ? 'متوسط' : 'چالشی',
      steps: [
        `میانگین قیمت فروش منو را ${avgPriceIncreasePct.toFixed(1)}٪ (متمرکز بر ${plowhorseNames}) ترمیم کنید.`,
        'برای آیتم‌های دارای سقف اتحادیه، فروش را با پک‌های کادویی میکس جبران کنید.',
      ],
    },
    {
      id: 'golden-path',
      title: 'مسیر ۳: مسیر طلایی ترکیبی (کم‌ریسک‌ترین راه)',
      subtitle: 'ترکیب متعادل اصلاح قیمت جزئی، رشد فروش و مهار پرت انبار',
      metricBadge: 'پیشنهاد مدیر مالی',
      feasibility: 'بالا',
      steps: [
        `تنها ${hybridPricePct.toFixed(1)}٪ اصلاح قیمت روی آیتم‌های غیراتحادیه‌ای و اسنپ‌فود.`,
        `افزایش فروش روزانه به میزان سبک ${hybridDailyKg.toFixed(1)} کیلو (معادل فقط ۲ تا ۳ جعبه بیشتر در روز).`,
        `مهار پرت نامرئی و ضایعات ویترین به ارزش ${Math.round(hybridWasteSave / 1_000_000).toLocaleString('fa-IR')} میلیون تومان در ماه.`,
      ],
    },
  ];
}

/**
 * Custom Cake & Fondant Pricing Engine (Tab 4A)
 */
export function computeCustomCakeQuote(
  cake: CustomCakePreset,
  data: WorkshopData,
  summary: ComputedWorkshopSummary
) {
  const baseMetric = summary.recipeMetrics.find((r) => r.recipeId === cake.baseRecipeId);
  const baseCostPerKg = baseMetric ? baseMetric.totalCostPerKg : 260000;
  const fondantUnitCost = summary.ingredientUnitCosts[cake.fondantIngredientId] ?? 250;

  const baseCakeCost = baseCostPerKg * Math.max(0.5, cake.weightKg);
  const fondantCost = fondantUnitCost * Math.max(0, cake.fondantKg) * 1000;
  const ganacheCost = Math.max(0, cake.ganacheCostPerKg) * Math.max(0.5, cake.weightKg);
  const materialsAndDecor =
    baseCakeCost +
    fondantCost +
    ganacheCost +
    Math.max(0, cake.topperAndFlowersCost) +
    Math.max(0, cake.boardAndTallBoxCost);

  const decoratorLaborCost = Math.max(0, cake.decoratorHours) * Math.max(0, cake.decoratorHourlyRate);
  const subtotalCost = materialsAndDecor + decoratorLaborCost;
  const complexityCost = subtotalCost * (Math.max(0, cake.complexitySurchargePct) / 100);
  const totalCost = subtotalCost + complexityCost;

  const targetM = Math.min(0.75, Math.max(0.15, cake.targetMarginPct / 100));
  const rawPrice = safeDiv(totalCost, 1 - targetM, totalCost * 1.5);
  const vatFactor = data.settings.vatEnabled ? 1 + data.settings.vatRatePct / 100 : 1;
  const finalQuote = roundToStep(rawPrice * vatFactor, data.settings.priceRoundingStep);
  const depositAmount = roundToStep(finalQuote * (Math.max(10, Math.min(100, cake.depositPct)) / 100), 10000);
  const netProfit = finalQuote - totalCost;
  const actualMarginPct = safeDiv(netProfit, finalQuote, 0) * 100;

  return {
    baseCakeCost,
    fondantCost,
    ganacheCost,
    decoratorLaborCost,
    complexityCost,
    totalCost,
    finalQuote,
    depositAmount,
    netProfit,
    actualMarginPct,
  };
}

/**
 * Seasonal Mix Box Engineering Engine (Tab 4B)
 */
export function computeMixBoxMetrics(
  mixBox: MixBoxPreset,
  data: WorkshopData,
  summary: ComputedWorkshopSummary
) {
  let totalGrams = 0;
  let pastryCost = 0;
  let singleBoxEquivalentRevenue = 0;
  let singleBoxEquivalentProfit = 0;

  const lineDetails = mixBox.items.map((item) => {
    const rm = summary.recipeMetrics.find((r) => r.recipeId === item.recipeId);
    const kg = Math.max(0, item.grams) / 1000;
    const itemCost = rm ? (rm.totalCostPerKg - rm.boxAndPackagingPerKg) * kg : 0;
    const singleRev = rm ? rm.storefrontPricePerKg * kg : 0;
    const singleProf = rm ? rm.netProfitPerKg * kg : 0;
    totalGrams += Math.max(0, item.grams);
    pastryCost += itemCost;
    singleBoxEquivalentRevenue += singleRev;
    singleBoxEquivalentProfit += singleProf;
    return {
      recipeId: item.recipeId,
      name: rm?.name ?? 'آیتم حذف‌شده',
      grams: item.grams,
      cost: itemCost,
      singleRev,
    };
  });

  const laborCost = (Math.max(0, mixBox.laborMinutes) / 60) * 240000;
  const packagingCost = Math.max(0, mixBox.boxCost) + Math.max(0, mixBox.ribbonAndCardCost);
  const totalCost = pastryCost + packagingCost + laborCost;

  const targetM = Math.min(0.75, Math.max(0.15, mixBox.targetMarginPct / 100));
  const recommendedPrice = roundToStep(safeDiv(totalCost, 1 - targetM, totalCost * 1.6), data.settings.priceRoundingStep);
  const netProfit = recommendedPrice - totalCost;
  const marginPct = safeDiv(netProfit, recommendedPrice, 0) * 100;
  const profitBoostVsSingle = netProfit - singleBoxEquivalentProfit;

  return {
    totalGrams,
    pastryCost,
    packagingCost,
    laborCost,
    totalCost,
    recommendedPrice,
    netProfit,
    marginPct,
    singleBoxEquivalentRevenue,
    singleBoxEquivalentProfit,
    profitBoostVsSingle,
    lineDetails,
  };
}

/**
 * Holiday Production Planner & Consolidated Shopping List (Pillar 3)
 */
export function computeProductionPlan(
  targetsKg: Record<string, number>,
  planDays: number,
  data: WorkshopData,
  summary: ComputedWorkshopSummary
) {
  const subMap = new Map(data.subRecipes.map((s) => [s.id, s]));
  const totalIngUsage: Record<string, number> = {};
  let totalOvenHoursNeeded = 0;
  let totalLaborHoursNeeded = 0;
  let projectedRevenue = 0;
  let projectedNetProfit = 0;
  let totalTargetKg = 0;

  for (const recipe of data.recipes) {
    const kg = Math.max(0, targetsKg[recipe.id] ?? 0);
    if (kg <= 0) continue;
    totalTargetKg += kg;
    const rm = summary.recipeMetrics.find((m) => m.recipeId === recipe.id);
    if (!rm) continue;

    const spoilageFactor = safeDiv(1, 1 - Math.min(0.6, Math.max(0, recipe.shelfLifeSpoilagePct / 100)), 1);
    const batches = safeDiv(kg * spoilageFactor, rm.netYieldKg, 0);
    flattenRecipeIngredientUsage(recipe.items, subMap, batches, totalIngUsage);

    if (data.settings.enforceBoxWeightDeduction && recipe.boxIngredientId) {
      totalIngUsage[recipe.boxIngredientId] = (totalIngUsage[recipe.boxIngredientId] ?? 0) + Math.ceil(kg);
    }

    totalOvenHoursNeeded += rm.ovenHoursPerKg * kg;
    totalLaborHoursNeeded += rm.laborHoursPerKg * kg;
    projectedRevenue += rm.blendedNetPricePerKg * kg;
    projectedNetProfit += rm.netProfitPerKg * kg;
  }

  const shoppingList = data.ingredients
    .filter((ing) => (totalIngUsage[ing.id] ?? 0) > 0)
    .map((ing) => {
      const requiredBase = totalIngUsage[ing.id] ?? 0;
      const netToBuyBase = Math.max(0, requiredBase - ing.currentStockInBase);
      const packsRequired = safeDiv(requiredBase, Math.max(1, ing.packQuantityInBase), 0);
      const packsToBuy = Math.ceil(safeDiv(netToBuyBase, Math.max(1, ing.packQuantityInBase), 0));
      const fullCashCost = packsRequired * ing.packPrice;
      const netCashNeeded = packsToBuy * ing.packPrice;
      return {
        ingredientId: ing.id,
        name: ing.name,
        packLabel: ing.packLabel,
        baseUnit: ing.baseUnit,
        requiredBase,
        inStockBase: ing.currentStockInBase,
        packsRequired,
        packsToBuy,
        fullCashCost,
        netCashNeeded,
      };
    })
    .sort((a, b) => b.fullCashCost - a.fullCashCost);

  const safeDays = Math.max(1, planDays);
  const availableOvenHours = data.settings.ovenCount * data.settings.dailyWorkingHours * safeDays;
  const activeStaffCount = Math.max(1, data.staff.filter((s) => s.active).length);
  const availableLaborHours = activeStaffCount * data.settings.dailyWorkingHours * safeDays;

  return {
    totalTargetKg,
    shoppingList,
    totalFullCashCost: shoppingList.reduce((s, r) => s + r.fullCashCost, 0),
    totalNetCashNeeded: shoppingList.reduce((s, r) => s + r.netCashNeeded, 0),
    totalOvenHoursNeeded,
    availableOvenHours,
    ovenOverloadPct: safeDiv(totalOvenHoursNeeded, availableOvenHours, 0) * 100,
    totalLaborHoursNeeded,
    availableLaborHours,
    laborOverloadPct: safeDiv(totalLaborHoursNeeded, availableLaborHours, 0) * 100,
    projectedRevenue,
    projectedNetProfit,
  };
}

/**
 * Sayadi Check 30-Day Liquidity Stress Test Timeline (Tab 5C)
 */
export function computeCashflowStressTimeline(
  data: WorkshopData,
  summary: ComputedWorkshopSummary,
  horizonDays = 35
) {
  const dailyCashIn = safeDiv(summary.totalMonthlyRevenue * 0.72, 30, 0); // Cash/POS storefront inflow
  const dailyOperatingOut = safeDiv(
    (summary.totalMonthlyMaterialCost + summary.totalMonthlyPackagingCost) * 0.45 +
      summary.totalMonthlyOverheadAndPayroll * 0.65,
    30,
    0
  );

  let runningBalance = data.settings.openingCashBalance;
  const points: Array<{
    day: number;
    label: string;
    balance: number;
    checkDelta: number;
    events: string[];
    isDanger: boolean;
  }> = [];

  const activeChecks = data.checks.filter((c) => c.status !== 'پاس‌شده');

  for (let day = 0; day <= horizonDays; day++) {
    let checkDelta = 0;
    const events: string[] = [];

    if (day > 0) {
      runningBalance += dailyCashIn - dailyOperatingOut;
    }

    for (const chk of activeChecks) {
      if (Math.round(chk.daysFromToday) === day) {
        if (chk.type === 'issued') {
          checkDelta -= chk.amount;
          events.push(`چک پرداختی: ${chk.counterparty}`);
        } else {
          checkDelta += chk.amount;
          events.push(`چک دریافتی: ${chk.counterparty}`);
        }
      }
    }

    runningBalance += checkDelta;
    points.push({
      day,
      label: day === 0 ? 'امروز' : `روز ${day}`,
      balance: Math.round(runningBalance),
      checkDelta,
      events,
      isDanger: runningBalance < 25_000_000,
    });
  }

  const minBalance = Math.min(...points.map((p) => p.balance));
  const dangerDays = points.filter((p) => p.isDanger);

  return { points, minBalance, dangerDays };
}
