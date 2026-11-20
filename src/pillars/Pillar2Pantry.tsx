import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Calculator,
  Check,
  Edit3,
  Package,
  Plus,
  Search,
  Trash2,
  Zap,
} from 'lucide-react';
import { useWorkshop } from '../store/WorkshopContext';
import {
  computeCashVsCheckArbitrage,
  computeStockpileArbitrage,
  computeWorkshopSummary,
  flattenRecipeIngredientUsage,
  getIngredientUnitCost,
} from '../utils/costEngine';
import {
  formatCurrency,
  formatDigits,
  formatNumber,
  formatPercent,
  safeDiv,
} from '../utils/formatters';
import { BaseUnit, Ingredient, IngredientCategory, VarianceRecord } from '../types';
import { HelpTip } from '../components/HelpTip';
import { GuidedBanner } from '../components/GuidedBanner';
import { LocaleNumberInput } from '../components/LocaleNumberInput';
import { PrivacyValue } from '../components/PrivacyValue';

type PantryTab = 'inventory' | 'variance' | 'arbitrage';

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  flour_sugar: 'آرد و شکر',
  butter_oil: 'کره و روغن',
  nuts_spice: 'مغزیجات و زعفران/هل',
  dairy_egg: 'لبنیات و تخم‌مرغ',
  chocolate_flavor: 'شکلات و طعم‌دهنده',
  packaging: 'جعبه و بسته‌بندی',
};

const PACK_PRESETS: Array<{ label: string; qty: number; unit: BaseUnit }> = [
  { label: 'کیسه ۴۰ کیلویی', qty: 40000, unit: 'gram' },
  { label: 'کیسه ۵۰ کیلویی', qty: 50000, unit: 'gram' },
  { label: 'کارتن ۱۰ کیلویی', qty: 10000, unit: 'gram' },
  { label: 'بسته ۵ کیلویی', qty: 5000, unit: 'gram' },
  { label: 'بسته ۱ کیلویی', qty: 1000, unit: 'gram' },
  { label: 'شانه ۳۰ عددی', qty: 30, unit: 'piece' },
  { label: 'مثقال ۴.۶۰۸ گرمی', qty: 4.608, unit: 'gram' },
  { label: 'سیر ۷۵ گرمی', qty: 75, unit: 'gram' },
  { label: 'بسته ۱۰۰ عددی جعبه', qty: 100, unit: 'piece' },
];

export const Pillar2Pantry: React.FC = () => {
  const {
    data,
    summary,
    upsertIngredient,
    deleteIngredient,
    bulkUpdateIngredientPrices,
    upsertVarianceRecord,
    deleteVarianceRecord,
  } = useWorkshop();

  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number, compact = false) =>
    formatCurrency(v, currencyUnit, usePersianDigits, compact);

  const [activeTab, setActiveTab] = useState<PantryTab>('inventory');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<IngredientCategory | 'all'>('all');
  const [quickMode, setQuickMode] = useState(false);
  const [quickDraftPrices, setQuickDraftPrices] = useState<Record<string, number>>({});

  // Ingredient Add/Edit Modal State
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);

  // Variance Add Form
  const [varIngId, setVarIngId] = useState<string>(data.ingredients[1]?.id ?? data.ingredients[0]?.id ?? '');
  const [varDays, setVarDays] = useState<number>(7);
  const [varActual, setVarActual] = useState<number>(10000);
  const [varNote, setVarNote] = useState<string>('');

  // Arbitrage 1: Stockpile
  const [stockpileAmount, setStockpileAmount] = useState<number>(80_000_000);
  const [expectedJumpPct, setExpectedJumpPct] = useState<number>(18);
  const [holdingMonths, setHoldingMonths] = useState<number>(2);
  const [capitalCostPct, setCapitalCostPct] = useState<number>(4);
  const [spoilageRiskPct, setSpoilageRiskPct] = useState<number>(2);

  // Arbitrage 2: Cash vs Sayadi Check
  const [invoiceAmount, setInvoiceAmount] = useState<number>(95_000_000);
  const [cashDiscountPct, setCashDiscountPct] = useState<number>(6);
  const [checkDays, setCheckDays] = useState<number>(60);
  const [checkCapitalCostPct, setCheckCapitalCostPct] = useState<number>(4.2);

  const filteredIngredients = useMemo(() => {
    return data.ingredients.filter((ing) => {
      if (catFilter !== 'all' && ing.category !== catFilter) return false;
      if (search.trim() && !ing.name.includes(search.trim()) && !ing.packLabel.includes(search.trim())) {
        return false;
      }
      return true;
    });
  }, [data.ingredients, catFilter, search]);

  // Live Margin Ripple Preview during 1-Minute Quick Update
  const quickRipplePreview = useMemo(() => {
    if (!quickMode || Object.keys(quickDraftPrices).length === 0) return null;
    const simulatedData = {
      ...data,
      ingredients: data.ingredients.map((i) =>
        quickDraftPrices[i.id] && quickDraftPrices[i.id] > 0
          ? { ...i, packPrice: quickDraftPrices[i.id] }
          : i
      ),
    };
    const nextSummary = computeWorkshopSummary(simulatedData);
    return {
      profitDelta: nextSummary.nominalMonthlyProfit - summary.nominalMonthlyProfit,
      marginBefore: summary.blendedNetMarginPct,
      marginAfter: nextSummary.blendedNetMarginPct,
      realDrawAfter: nextSummary.realSafeOwnerDraw,
    };
  }, [quickMode, quickDraftPrices, data, summary]);

  // Theoretical monthly usage per ingredient for Variance Detective
  const theoreticalMonthlyByIng = useMemo(() => {
    const subMap = new Map(data.subRecipes.map((s) => [s.id, s]));
    const usage: Record<string, number> = {};
    for (const r of data.recipes) {
      const rm = summary.recipeMetrics.find((m) => m.recipeId === r.id);
      if (!rm || r.monthlySalesKg <= 0) continue;
      const spoilageFactor = safeDiv(1, 1 - Math.min(0.6, Math.max(0, r.shelfLifeSpoilagePct / 100)), 1);
      const batches = safeDiv(r.monthlySalesKg * spoilageFactor, rm.netYieldKg, 0);
      flattenRecipeIngredientUsage(r.items, subMap, batches, usage);
    }
    return usage;
  }, [data.recipes, data.subRecipes, summary.recipeMetrics]);

  const stockpileResult = useMemo(
    () =>
      computeStockpileArbitrage({
        purchaseAmountToman: stockpileAmount,
        expectedPriceJumpPct: expectedJumpPct,
        holdingMonths,
        monthlyCapitalCostPct: capitalCostPct,
        spoilageRiskPct,
      }),
    [stockpileAmount, expectedJumpPct, holdingMonths, capitalCostPct, spoilageRiskPct]
  );

  const cashVsCheckResult = useMemo(
    () =>
      computeCashVsCheckArbitrage({
        invoiceAmountToman: invoiceAmount,
        cashDiscountPct,
        checkDays,
        monthlyCapitalCostPct: checkCapitalCostPct,
      }),
    [invoiceAmount, cashDiscountPct, checkDays, checkCapitalCostPct]
  );

  const lowStockCount = data.ingredients.filter((i) => i.currentStockInBase <= i.safetyStockInBase).length;

  const openNewIngredient = () => {
    setEditingIng({
      id: `ing-${Date.now()}`,
      name: '',
      category: 'butter_oil',
      packLabel: 'کارتن ۱۰ کیلویی',
      packQuantityInBase: 10000,
      baseUnit: 'gram',
      packPrice: 1000000,
      previousPackPrice: 1000000,
      monthlyInflationPct: 3.5,
      currentStockInBase: 10000,
      safetyStockInBase: 5000,
      supplierName: '',
      history: [{ dateShamsi: 'فعلی', packPrice: 1000000 }],
    });
  };

  const handleSaveIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIng || !editingIng.name.trim()) return;
    upsertIngredient({
      ...editingIng,
      name: editingIng.name.trim(),
      packQuantityInBase: Math.max(0.001, editingIng.packQuantityInBase),
      packPrice: Math.max(1, editingIng.packPrice),
    });
    setEditingIng(null);
  };

  const handleAddVariance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!varIngId || varActual <= 0) return;
    const rec: VarianceRecord = {
      id: `var-${Date.now()}`,
      ingredientId: varIngId,
      periodLabel: `${formatDigits(varDays, usePersianDigits)} روز اخیر`,
      periodDays: Math.max(1, varDays),
      actualUsedInBase: varActual,
      note: varNote.trim() || undefined,
    };
    upsertVarianceRecord(rec);
    setVarNote('');
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#2B1E1A]">
            انبار هوشمند، دزدگیر پرت و آربیتراژ بازار ایران
          </h1>
          <p className="text-xs text-[#7D6C63] mt-0.5">
            تبدیل خودکار واحد بازار (کیسه/کارتن/مثقال/شانه) به گرم و رصد لحظه‌ای اثر تغییر قیمت‌ها روی کل منو
          </p>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#92400E] bg-[#FFFBEB] border border-[#F5D08A] rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-4 h-4 text-[#D97706]" />
            <span>{formatDigits(lowStockCount, usePersianDigits)} قلم زیر حداقل موجودی اطمینان</span>
          </div>
        )}
      </div>

      {/* Sub-Tabs */}
      <div
        role="tablist"
        aria-label="زیربخش‌های انبار و بازار"
        className="mb-5 flex flex-wrap gap-1.5 bg-white border border-[#EAE2D8] rounded-xl p-1.5"
      >
        {[
          { id: 'inventory' as const, label: '۲A. انبار و به‌روزرسانی ۱ دقیقه‌ای قیمت', icon: Package },
          { id: 'variance' as const, label: '۲B. مغایرت‌گیر «پرت نامرئی» انبار', icon: AlertTriangle },
          { id: 'arbitrage' as const, label: '۲C. معماهای بازار: دپو و نقد/چکی', icon: ArrowLeftRight },
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

      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <GuidedBanner text="پس از هر خرید بازار، دکمه «به‌روزرسانی ۱ دقیقه‌ای» را بزنید تا قیمت جدید کارتن و کیسه را وارد کرده و اثر فوری آن روی سود کل منو را ببینید." />

          {/* Toolbar */}
          <div className="bg-white border border-[#EAE2D8] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 text-[#8C7B72] absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="جستجو در مواد اولیه..."
                  className="w-full rounded-lg border border-[#EAE2D8] bg-[#FAF8F5] pr-9 pl-3 py-2 text-xs focus:bg-white focus:border-[#2D6A4F] focus:outline-none"
                />
              </div>

              <select
                aria-label="فیلتر دسته‌بندی مواد"
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value as IngredientCategory | 'all')}
                className="rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-semibold text-[#2B1E1A] focus:border-[#2D6A4F] focus:outline-none"
              >
                <option value="all">همه دسته‌ها ({formatDigits(data.ingredients.length, usePersianDigits)})</option>
                {(Object.keys(CATEGORY_LABELS) as IngredientCategory[]).map((k) => (
                  <option key={k} value={k}>
                    {CATEGORY_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (quickMode) {
                      setQuickMode(false);
                      setQuickDraftPrices({});
                    } else {
                      const initial: Record<string, number> = {};
                      data.ingredients.forEach((i) => {
                        initial[i.id] = i.packPrice;
                      });
                      setQuickDraftPrices(initial);
                      setQuickMode(true);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    quickMode
                      ? 'bg-[#D97706] text-white hover:bg-[#B45309]'
                      : 'bg-[#FFFBEB] text-[#92400E] border border-[#F5D08A] hover:bg-[#FEF3C7]'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{quickMode ? 'لغو حالت سریع' : 'به‌روزرسانی ۱ دقیقه‌ای بازار'}</span>
                </button>
                <HelpTip id="quickUpdate" />
              </div>

              <button
                type="button"
                onClick={openNewIngredient}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن ماده اولیه</span>
              </button>
            </div>
          </div>

          {/* Live Margin Ripple Preview Bar in Quick-Update Mode */}
          {quickMode && quickRipplePreview && (
            <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-extrabold text-[#312E81]">
                  پیش‌نمایش زنده اثر تغییر قیمت بازار روی کل کارگاه (قبل از ذخیره):
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
                  <span>
                    تغییر سود ماهانه:{' '}
                    <strong
                      className={
                        quickRipplePreview.profitDelta >= 0 ? 'text-[#2D6A4F]' : 'text-[#C84B31]'
                      }
                    >
                      <PrivacyValue>
                        {quickRipplePreview.profitDelta >= 0 ? '+' : ''}
                        {fmt(quickRipplePreview.profitDelta, true)}
                      </PrivacyValue>
                    </strong>
                  </span>
                  <span>
                    حاشیه سود منو:{' '}
                    <strong>
                      {formatPercent(quickRipplePreview.marginBefore, usePersianDigits)} ←{' '}
                      {formatPercent(quickRipplePreview.marginAfter, usePersianDigits)}
                    </strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  bulkUpdateIngredientPrices(quickDraftPrices, 'به‌روزرسانی سریع قیمت بازار');
                  setQuickMode(false);
                  setQuickDraftPrices({});
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>ثبت همه قیمت‌ها و محاسبه مجدد</span>
              </button>
            </div>
          )}

          {/* Ingredients Data Table */}
          <div className="bg-white border border-[#EAE2D8] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#EAE2D8] text-[#6E5C54]">
                    <th className="py-3 px-3 font-bold">نام ماده اولیه</th>
                    <th className="py-3 px-3 font-bold">
                      بسته‌بندی بازار <HelpTip id="packConverter" />
                    </th>
                    <th className="py-3 px-3 font-bold">قیمت بسته (تومان)</th>
                    <th className="py-3 px-3 font-bold">بهای هر واحد پایه</th>
                    <th className="py-3 px-3 font-bold">تغییر / تورم ماهانه</th>
                    <th className="py-3 px-3 font-bold">موجودی انبار</th>
                    <th className="py-3 px-3 font-bold text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3ECE4]">
                  {filteredIngredients.map((ing) => {
                    const unitCost = getIngredientUnitCost(ing);
                    const unitName =
                      ing.baseUnit === 'gram' ? 'گرم' : ing.baseUnit === 'ml' ? 'میلی‌لیتر' : 'عدد';
                    const priceDeltaPct =
                      ing.previousPackPrice > 0
                        ? ((ing.packPrice - ing.previousPackPrice) / ing.previousPackPrice) * 100
                        : 0;
                    const isLowStock = ing.currentStockInBase <= ing.safetyStockInBase;
                    const padY = data.settings.tableDensity === 'compact' ? 'py-2' : 'py-3';

                    return (
                      <tr key={ing.id} className="hover:bg-[#FAF8F5]">
                        <td className={`${padY} px-3`}>
                          <div className="font-bold text-[#2B1E1A]">{ing.name}</div>
                          <div className="text-[11px] text-[#7D6C63]">
                            {CATEGORY_LABELS[ing.category]}
                            {ing.supplierName ? ` · ${ing.supplierName}` : ''}
                          </div>
                        </td>
                        <td className={`${padY} px-3 text-[#4B3B34]`}>
                          <div>{ing.packLabel}</div>
                          <div className="text-[11px] text-[#8C7B72] tabular-nums">
                            {formatNumber(ing.packQuantityInBase, {
                              decimals: ing.packQuantityInBase < 10 ? 3 : 0,
                              usePersian: usePersianDigits,
                            })}{' '}
                            {unitName}
                          </div>
                        </td>
                        <td className={`${padY} px-3 tabular-nums`}>
                          {quickMode ? (
                            <div className="w-36">
                              <LocaleNumberInput
                                value={quickDraftPrices[ing.id] ?? ing.packPrice}
                                onChange={(val) =>
                                  setQuickDraftPrices((p) => ({ ...p, [ing.id]: val }))
                                }
                                ariaLabel={`قیمت بسته ${ing.name}`}
                              />
                            </div>
                          ) : (
                            <span className="font-extrabold text-[#2B1E1A]">
                              {fmt(ing.packPrice)}
                            </span>
                          )}
                        </td>
                        <td className={`${padY} px-3 tabular-nums font-bold text-[#2D6A4F]`}>
                          {formatNumber(unitCost, {
                            decimals: unitCost < 100 ? 1 : 0,
                            usePersian: usePersianDigits,
                          })}{' '}
                          ت / {unitName}
                        </td>
                        <td className={`${padY} px-3 tabular-nums`}>
                          <div
                            className={`font-bold ${
                              priceDeltaPct > 5
                                ? 'text-[#C84B31]'
                                : priceDeltaPct > 0
                                ? 'text-[#D97706]'
                                : 'text-[#2D6A4F]'
                            }`}
                          >
                            {priceDeltaPct > 0 ? '+' : ''}
                            {formatPercent(priceDeltaPct, usePersianDigits)}
                          </div>
                          <div className="text-[11px] text-[#7D6C63]">
                            تورم ماهانه: {formatPercent(ing.monthlyInflationPct, usePersianDigits)}
                          </div>
                        </td>
                        <td className={`${padY} px-3 tabular-nums`}>
                          <div
                            className={`font-bold ${
                              isLowStock ? 'text-[#C84B31]' : 'text-[#2B1E1A]'
                            }`}
                          >
                            {ing.baseUnit === 'gram'
                              ? `${formatNumber(ing.currentStockInBase / 1000, {
                                  decimals: 1,
                                  usePersian: usePersianDigits,
                                })} کیلو`
                              : `${formatNumber(ing.currentStockInBase, {
                                  usePersian: usePersianDigits,
                                })} ${unitName}`}
                          </div>
                          {isLowStock && (
                            <div className="text-[11px] text-[#C84B31] font-semibold">
                              نیاز به سفارش فوری
                            </div>
                          )}
                        </td>
                        <td className={`${padY} px-3 text-left`}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`ویرایش ${ing.name}`}
                              onClick={() => setEditingIng(ing)}
                              className="p-1.5 rounded-lg text-[#5A4A42] hover:bg-[#EFE7DC] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`حذف ${ing.name}`}
                              onClick={() => deleteIngredient(ing.id)}
                              className="p-1.5 rounded-lg text-[#C84B31] hover:bg-[#FEF2F2] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'variance' && (
        <div className="space-y-5">
          <GuidedBanner text="هر آخر هفته مصرف واقعی مواد گران‌قیمت (کره، پسته، خامه، شکلات) را وارد کنید تا مغایرت‌گیر فوراً پرت نامرئی را به گرم و تومان افشا کند." />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Add Variance Form */}
            <form
              onSubmit={handleAddVariance}
              className="lg:col-span-4 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-3.5"
            >
              <h2 className="text-sm font-extrabold text-[#2B1E1A] flex items-center">
                ثبت شمارش مصرف واقعی انبار
                <HelpTip id="invisibleVariance" />
              </h2>

              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                  ماده اولیه پرهزینه:
                </label>
                <select
                  value={varIngId}
                  onChange={(e) => setVarIngId(e.target.value)}
                  className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-semibold"
                >
                  {data.ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                    بازه (روز):
                  </label>
                  <LocaleNumberInput value={varDays} onChange={setVarDays} min={1} max={31} suffix="روز" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                    مصرف واقعی (گرم/عدد):
                  </label>
                  <LocaleNumberInput value={varActual} onChange={setVarActual} min={1} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">یادداشت بررسی:</label>
                <input
                  type="text"
                  value={varNote}
                  onChange={(e) => setVarNote(e.target.value)}
                  placeholder="مثلاً: اضافه مصرف کره در خط هزارلا"
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#2B1E1A] text-white text-xs font-bold hover:bg-[#3E2D27] cursor-pointer"
              >
                ثبت و کشف پرت نامرئی
              </button>
            </form>

            {/* Variance Results Table */}
            <div className="lg:col-span-8 bg-white border border-[#EAE2D8] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-extrabold text-[#2B1E1A]">
                  گزارش مغایرت مصرف تئوری در برابر مصرف واقعی
                </h2>
                <span className="text-xs font-extrabold text-[#C84B31] tabular-nums">
                  زیان ماهانه پرت نامرئی:{' '}
                  <PrivacyValue>{fmt(summary.wasteBreakdown.invisibleVarianceCost, true)}</PrivacyValue>
                </span>
              </div>

              <div className="space-y-3">
                {data.varianceRecords.map((rec) => {
                  const ing = data.ingredients.find((i) => i.id === rec.ingredientId);
                  if (!ing) return null;
                  const theoMonthly = theoreticalMonthlyByIng[ing.id] ?? 0;
                  const theoPeriod = theoMonthly * (rec.periodDays / 30);
                  const diffBase = rec.actualUsedInBase - theoPeriod;
                  const diffPct = safeDiv(diffBase, Math.max(1, theoPeriod), 0) * 100;
                  const unitCost = getIngredientUnitCost(ing);
                  const periodLoss = Math.max(0, diffBase) * unitCost;
                  const monthlyLoss = periodLoss * (30 / Math.max(1, rec.periodDays));
                  const isGram = ing.baseUnit === 'gram';

                  return (
                    <div
                      key={rec.id}
                      className={`rounded-xl border p-4 ${
                        diffBase > 0
                          ? 'bg-[#FEF2F2]/60 border-[#F5C2B8]'
                          : 'bg-[#ECFDF5]/60 border-[#A7F3D0]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-extrabold text-[#2B1E1A]">{ing.name}</div>
                          <div className="text-[11px] text-[#6E5C54]">{rec.periodLabel}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <div
                              className={`text-sm font-extrabold tabular-nums ${
                                diffBase > 0 ? 'text-[#C84B31]' : 'text-[#2D6A4F]'
                              }`}
                            >
                              {diffBase > 0 ? '+' : ''}
                              {isGram
                                ? `${formatNumber(diffBase / 1000, { decimals: 2, usePersian: usePersianDigits })} کیلو`
                                : `${formatNumber(diffBase, { usePersian: usePersianDigits })} عدد`}{' '}
                              ({formatPercent(diffPct, usePersianDigits)})
                            </div>
                            <div className="text-[11px] text-[#991B1B] font-bold tabular-nums">
                              زیان ماهانه: <PrivacyValue>{fmt(monthlyLoss, true)}</PrivacyValue>
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label={`حذف مغایرت ${ing.name}`}
                            onClick={() => deleteVarianceRecord(rec.id)}
                            className="p-1.5 rounded-lg text-[#8C7B72] hover:text-[#C84B31] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs tabular-nums text-[#4B3B34]">
                        <div>
                          مصرف تئوری طبق فروش:{' '}
                          <strong>
                            {isGram
                              ? `${formatNumber(theoPeriod / 1000, { decimals: 2, usePersian: usePersianDigits })} کیلو`
                              : `${formatNumber(theoPeriod, { usePersian: usePersianDigits })} عدد`}
                          </strong>
                        </div>
                        <div>
                          مصرف واقعی انبار:{' '}
                          <strong>
                            {isGram
                              ? `${formatNumber(rec.actualUsedInBase / 1000, { decimals: 2, usePersian: usePersianDigits })} کیلو`
                              : `${formatNumber(rec.actualUsedInBase, { usePersian: usePersianDigits })} عدد`}
                          </strong>
                        </div>
                        <div>
                          زیان همین دوره: <strong><PrivacyValue>{fmt(periodLoss, true)}</PrivacyValue></strong>
                        </div>
                      </div>
                      {rec.note && (
                        <div className="mt-2 text-[11px] text-[#5A4A42] bg-white/70 rounded-lg px-2.5 py-1.5 border border-[#EAE2D8]">
                          {rec.note}
                        </div>
                      )}
                    </div>
                  );
                })}
                {data.varianceRecords.length === 0 && (
                  <div className="text-center py-8 text-xs text-[#7D6C63]">
                    هنوز رکورد انبارگردانی ثبت نشده است.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'arbitrage' && (
        <div className="space-y-4">
          <GuidedBanner text="قبل از خرید عمده یا بستن فاکتور بنکداری، با این دو ماشین‌حساب دقیقاً بسنجید دپو کردن یا پرداخت نقدی به سود شماست یا خرید چکی!" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Arbitrage 1: Stockpile Calculator */}
            <section className="bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
                  <Calculator className="w-4.5 h-4.5 text-[#2D6A4F]" />
                  <span>معمای ۱: «دپو کنم یا نه؟» (آربیتراژ خرید عمده)</span>
                  <HelpTip id="stockpileArbitrage" />
                </h2>
                <p className="text-xs text-[#7D6C63] mt-0.5">
                  مقایسه سود جهش قیمت کالا در برابر هزینه خواب سرمایه و ریسک نگهداری/فاسدشدن
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">مبلغ خرید دپو (تومان)</label>
                  <LocaleNumberInput value={stockpileAmount} onChange={setStockpileAmount} suffix="تومان" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">جهش قیمت مورد انتظار (%)</label>
                  <LocaleNumberInput value={expectedJumpPct} onChange={setExpectedJumpPct} suffix="درصد" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">مدت نگهداری در انبار (ماه)</label>
                  <LocaleNumberInput value={holdingMonths} onChange={setHoldingMonths} suffix="ماه" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">هزینه ماهانه سرمایه (%)</label>
                  <LocaleNumberInput value={capitalCostPct} onChange={setCapitalCostPct} suffix="درصد" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                    ریسک ضایعات، یخچال و افت کیفیت (%)
                  </label>
                  <LocaleNumberInput value={spoilageRiskPct} onChange={setSpoilageRiskPct} suffix="درصد" />
                </div>
              </div>

              <div
                className={`rounded-xl p-4 border ${
                  stockpileResult.verdict === 'stockpile'
                    ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                    : 'bg-[#FEF2F2] border-[#F5C2B8]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#2B1E1A]">حکم قطعی مالی:</span>
                  <span
                    className={`text-sm font-extrabold ${
                      stockpileResult.verdict === 'stockpile' ? 'text-[#2D6A4F]' : 'text-[#C84B31]'
                    }`}
                  >
                    {stockpileResult.verdict === 'stockpile'
                      ? 'دپو کردن به‌صرفه است'
                      : 'دپو نکنید — خرید تدریجی بهتر است'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs tabular-nums">
                  <div>
                    سود خالص آربیتراژ:{' '}
                    <strong className="text-[#2B1E1A]">{fmt(stockpileResult.netBenefit)}</strong>
                  </div>
                  <div>
                    بازده خالص: <strong>{formatPercent(stockpileResult.roiPct, usePersianDigits)}</strong>
                  </div>
                  <div>
                    سود جهش قیمت: <span>{fmt(stockpileResult.inflationGain, true)}</span>
                  </div>
                  <div>
                    حداکثر مدت دپوی امن:{' '}
                    <strong>
                      {formatNumber(stockpileResult.optimalMaxMonths, {
                        decimals: 1,
                        usePersian: usePersianDigits,
                      })}{' '}
                      ماه
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            {/* Arbitrage 2: Cash Discount vs Sayadi Check */}
            <section className="bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
                  <ArrowLeftRight className="w-4.5 h-4.5 text-[#4338CA]" />
                  <span>معمای ۲: «نقد بخرم با تخفیف یا چکی ۶۰ روزه؟»</span>
                  <HelpTip id="cashVsCheck" />
                </h2>
                <p className="text-xs text-[#7D6C63] mt-0.5">
                  مقایسه تخفیف نقدی بنکدار با ارزش زمانی پول در بازه چک صیادی
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">مبلغ کل فاکتور (تومان)</label>
                  <LocaleNumberInput value={invoiceAmount} onChange={setInvoiceAmount} suffix="تومان" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">تخفیف نقدی فروشنده (%)</label>
                  <LocaleNumberInput value={cashDiscountPct} onChange={setCashDiscountPct} suffix="درصد" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">مدت چک صیادی (روز)</label>
                  <LocaleNumberInput value={checkDays} onChange={setCheckDays} suffix="روز" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                    نرخ تورم / بازده ماهانه پول (%)
                  </label>
                  <LocaleNumberInput
                    value={checkCapitalCostPct}
                    onChange={setCheckCapitalCostPct}
                    suffix="درصد"
                  />
                </div>
              </div>

              <div
                className={`rounded-xl p-4 border ${
                  cashVsCheckResult.verdict === 'buy_cash'
                    ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                    : 'bg-[#EEF2FF] border-[#C7D2FE]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#2B1E1A]">حکم قطعی مالی:</span>
                  <span
                    className={`text-sm font-extrabold ${
                      cashVsCheckResult.verdict === 'buy_cash' ? 'text-[#2D6A4F]' : 'text-[#4338CA]'
                    }`}
                  >
                    {cashVsCheckResult.verdict === 'buy_cash'
                      ? 'نقدی بخرید (تخفیف می‌ارزد)'
                      : 'چکی بخرید (نقدینگی را حفظ کنید)'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs tabular-nums">
                  <div>
                    سود/برتری انتخاب برتر:{' '}
                    <strong>{fmt(Math.abs(cashVsCheckResult.netCashAdvantage))}</strong>
                  </div>
                  <div>
                    تخفیف سربه‌سر نقدی:{' '}
                    <strong>
                      {formatPercent(cashVsCheckResult.breakEvenDiscountPct, usePersianDigits)}
                    </strong>
                  </div>
                  <div>
                    تخفیف نقدی فاکتور: <span>{fmt(cashVsCheckResult.cashSaved, true)}</span>
                  </div>
                  <div>
                    ارزش زمانی پول چک: <span>{fmt(cashVsCheckResult.timeValueOfMoney, true)}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Add / Edit Ingredient Modal */}
      {editingIng && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ویرایش ماده اولیه"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveIngredient}
            className="bg-white border border-[#EAE2D8] rounded-2xl max-w-xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-[#2B1E1A]">
              ثبت یا ویرایش ماده اولیه و بسته‌بندی بازار
            </h3>

            {/* Quick Iranian Market Unit Presets */}
            <div>
              <div className="text-[11px] font-bold text-[#6E5C54] mb-1.5">
                انتخاب سریع واحدهای رایج بازار ایران:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PACK_PRESETS.map((pr) => (
                  <button
                    key={pr.label}
                    type="button"
                    onClick={() =>
                      setEditingIng((prev) =>
                        prev
                          ? {
                              ...prev,
                              packLabel: pr.label,
                              packQuantityInBase: pr.qty,
                              baseUnit: pr.unit,
                            }
                          : prev
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#EAE2D8] hover:border-[#2D6A4F] text-[11px] font-semibold cursor-pointer"
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">نام ماده اولیه *</label>
                <input
                  required
                  type="text"
                  value={editingIng.name}
                  onChange={(e) => setEditingIng({ ...editingIng, name: e.target.value })}
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">دسته‌بندی</label>
                <select
                  value={editingIng.category}
                  onChange={(e) =>
                    setEditingIng({ ...editingIng, category: e.target.value as IngredientCategory })
                  }
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs bg-white"
                >
                  {(Object.keys(CATEGORY_LABELS) as IngredientCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {CATEGORY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">عنوان بسته بازار</label>
                <input
                  type="text"
                  value={editingIng.packLabel}
                  onChange={(e) => setEditingIng({ ...editingIng, packLabel: e.target.value })}
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">واحد پایه دستور پخت</label>
                <select
                  value={editingIng.baseUnit}
                  onChange={(e) =>
                    setEditingIng({ ...editingIng, baseUnit: e.target.value as BaseUnit })
                  }
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs bg-white"
                >
                  <option value="gram">گرم</option>
                  <option value="ml">میلی‌لیتر</option>
                  <option value="piece">عدد</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                  مقدار در هر بسته (به واحد پایه)
                </label>
                <LocaleNumberInput
                  value={editingIng.packQuantityInBase}
                  onChange={(v) => setEditingIng({ ...editingIng, packQuantityInBase: v })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">
                  قیمت هر بسته بازار (تومان)
                </label>
                <LocaleNumberInput
                  value={editingIng.packPrice}
                  onChange={(v) => setEditingIng({ ...editingIng, packPrice: v })}
                  suffix="تومان"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">تورم ماهانه مورد انتظار (%)</label>
                <LocaleNumberInput
                  value={editingIng.monthlyInflationPct}
                  onChange={(v) => setEditingIng({ ...editingIng, monthlyInflationPct: v })}
                  suffix="درصد"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">نام تامین‌کننده</label>
                <input
                  type="text"
                  value={editingIng.supplierName ?? ''}
                  onChange={(e) => setEditingIng({ ...editingIng, supplierName: e.target.value })}
                  className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">موجودی فعلی (واحد پایه)</label>
                <LocaleNumberInput
                  value={editingIng.currentStockInBase}
                  onChange={(v) => setEditingIng({ ...editingIng, currentStockInBase: v })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">حداقل موجودی اطمینان</label>
                <LocaleNumberInput
                  value={editingIng.safetyStockInBase}
                  onChange={(v) => setEditingIng({ ...editingIng, safetyStockInBase: v })}
                />
              </div>
            </div>

            <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg px-3 py-2 text-xs text-[#065F46] font-bold tabular-nums">
              بهای دقیق هر ۱ واحد پایه:{' '}
              {formatNumber(getIngredientUnitCost(editingIng), {
                decimals: 1,
                usePersian: usePersianDigits,
              })}{' '}
              تومان
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F2EBE2]">
              <button
                type="button"
                onClick={() => setEditingIng(null)}
                className="px-4 py-2 rounded-lg border border-[#EAE2D8] text-xs font-bold text-[#5A4A42] cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] cursor-pointer"
              >
                ذخیره و به‌روزرسانی کل منو
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
