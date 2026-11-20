import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Calendar,
  ChefHat,
  Edit3,
  Layers,
  Moon,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { useWorkshop } from '../store/WorkshopContext';
import {
  formatCurrency,
  formatDigits,
  formatNumber,
  formatPercent,
} from '../utils/formatters';
import { Recipe, SubRecipe } from '../types';
import { HelpTip } from '../components/HelpTip';
import { GuidedBanner } from '../components/GuidedBanner';
import { PrivacyValue } from '../components/PrivacyValue';
import { LocaleNumberInput } from '../components/LocaleNumberInput';
import { RecipeEditorModal } from './pillar3/RecipeEditorModal';
import { AbSwapLab, PrintableChefCard } from './pillar3/AbSwapAndChefCard';
import { HolidayProductionPlanner } from './pillar3/HolidayProductionPlanner';

type Pillar3Tab = 'recipes' | 'subrecipes' | 'ab_lab' | 'chef_card' | 'planner';

export const Pillar3Recipes: React.FC = () => {
  const {
    data,
    summary,
    upsertRecipe,
    deleteRecipe,
    upsertSubRecipe,
    deleteSubRecipe,
    notify,
  } = useWorkshop();

  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number, compact = false) =>
    formatCurrency(v, currencyUnit, usePersianDigits, compact);

  const [activeTab, setActiveTab] = useState<Pillar3Tab>('recipes');
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubYield, setNewSubYield] = useState(2000);
  const [newSubIngId, setNewSubIngId] = useState(data.ingredients[0]?.id ?? '');
  const [newSubIngAmt, setNewSubIngAmt] = useState(1200);

  const openNewRecipe = () => {
    setEditingRecipe({
      id: `rec-${Date.now()}`,
      name: '',
      category: 'خشک',
      items: [
        {
          id: `li-${Date.now()}`,
          kind: 'ingredient',
          refId: data.ingredients[0]?.id ?? '',
          amount: 1500,
        },
      ],
      boxIngredientId:
        data.ingredients.find((i) => i.category === 'packaging')?.id ?? data.ingredients[0]?.id ?? '',
      extraPackagingCostPerKg: 6000,
      bakingChangePct: -8,
      trimWastePct: 3,
      shelfLifeSpoilagePct: 3,
      ovenMinutesPerBatch: 25,
      ovenTraysPerBatch: 4,
      ovenTempCelsius: 185,
      directLaborMinutesPerBatch: 40,
      sellingPricePerKg: 420000,
      cafeDiscountPct: 12,
      snappfoodMarkupPct: 20,
      monthlySalesKg: 100,
      channelMix: { storefrontPct: 70, cafeB2BPct: 10, snappfoodPct: 15, customEventPct: 5 },
      chefInstructions: '',
    });
  };

  const handleAddSubRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubIngId) return;
    const sr: SubRecipe = {
      id: `sub-${Date.now()}`,
      name: newSubName.trim(),
      yieldGrams: Math.max(100, newSubYield),
      bakingChangePct: -5,
      items: [{ id: `sli-${Date.now()}`, kind: 'ingredient', refId: newSubIngId, amount: newSubIngAmt }],
    };
    upsertSubRecipe(sr);
    setNewSubName('');
  };

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#2B1E1A]">
            آزمایشگاه فرمولاسیون، قانون اتحادیه، مقایسه A/B و تولید
          </h1>
          <p className="text-xs text-[#7D6C63] mt-0.5">
            بهایابی دقیق با لحاظ افت پخت، شربت‌خوری، کسر وزن جعبه، کف حراج آخر شب و سود هر ساعت فر
          </p>
        </div>

        {activeTab === 'recipes' && (
          <button
            type="button"
            onClick={openNewRecipe}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن شیرینی جدید</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="تب‌های آزمایشگاه فرمولاسیون و تولید"
        className="no-print mb-5 flex flex-wrap gap-1.5 bg-white border border-[#EAE2D8] rounded-xl p-1.5"
      >
        {[
          { id: 'recipes' as const, label: 'محصولات و بهایابی منو', icon: ChefHat },
          { id: 'subrecipes' as const, label: 'مواد نیمه‌ساخته (کرم/شربت)', icon: Layers },
          { id: 'ab_lab' as const, label: 'آزمایشگاه مقایسه A/B', icon: ArrowLeftRight },
          { id: 'chef_card' as const, label: 'کارت پخت چاپی استادکار', icon: Printer },
          { id: 'planner' as const, label: 'برنامه‌ریز مناسبتی و لیست خرید', icon: Calendar },
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

      {activeTab === 'recipes' && (
        <div className="space-y-4">
          <GuidedBanner text="روی هر شیرینی می‌توانید قیمت پیشنهادی ۳ سطحی (اقتصادی، استاندارد، لوکس) را با یک کلیک اعمال کنید و کف قیمت حراج آخر شب را ببینید." />

          <div className="grid grid-cols-1 gap-4">
            {summary.recipeMetrics.map((rm) => {
              const raw = data.recipes.find((r) => r.id === rm.recipeId);
              if (!raw) return null;
              return (
                <article
                  key={rm.recipeId}
                  className="bg-white border border-[#EAE2D8] rounded-xl p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#F2EBE2]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-extrabold text-[#2B1E1A]">{rm.name}</h2>
                        <span className="text-xs text-[#7D6C63]">· {rm.category}</span>
                        <span className="text-xs text-[#7D6C63] tabular-nums">
                          · فروش ماهانه: {formatNumber(rm.monthlySalesKg, { usePersian: usePersianDigits })} کیلو
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#6E5C54] tabular-nums">
                        <span>
                          بازده خالص هر پخت: {formatNumber(rm.netYieldKg, { decimals: 2, usePersian: usePersianDigits })} کیلو
                        </span>
                        <span>· افت/شربت: {formatDigits(raw.bakingChangePct, usePersianDigits)}٪</span>
                        <span>· بیاتی: {formatDigits(raw.shelfLifeSpoilagePct, usePersianDigits)}٪</span>
                        {raw.unionPriceCeiling && (
                          <span
                            className={`font-bold ${
                              rm.unionCeilingStatus === 'exceeded'
                                ? 'text-[#C84B31]'
                                : rm.unionCeilingStatus === 'squeezed'
                                ? 'text-[#D97706]'
                                : 'text-[#2D6A4F]'
                            }`}
                          >
                            · سقف اتحادیه: {fmt(raw.unionPriceCeiling)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingRecipe(raw)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#EAE2D8] bg-[#FAF8F5] hover:bg-[#EFE7DC] text-xs font-bold text-[#2B1E1A] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش فرمول</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`حذف ${rm.name}`}
                        onClick={() => deleteRecipe(raw.id)}
                        className="p-1.5 rounded-lg text-[#C84B31] hover:bg-[#FEF2F2] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Costing Breakdown Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 py-4 text-xs tabular-nums">
                    <div>
                      <div className="text-[#7D6C63]">مواد + بیاتی/کیلو</div>
                      <div className="font-bold text-[#2B1E1A] mt-0.5">
                        <PrivacyValue>{fmt(rm.spoilageAdjustedMaterialCostPerKg)}</PrivacyValue>
                      </div>
                    </div>
                    <div>
                      <div className="text-[#7D6C63]">جعبه و بسته‌بندی</div>
                      <div className="font-bold text-[#2B1E1A] mt-0.5">
                        <PrivacyValue>{fmt(rm.boxAndPackagingPerKg)}</PrivacyValue>
                      </div>
                    </div>
                    <div>
                      <div className="text-[#7D6C63]">سهم سربار/کیلو</div>
                      <div className="font-bold text-[#2B1E1A] mt-0.5">
                        <PrivacyValue>{fmt(rm.allocatedOverheadPerKg)}</PrivacyValue>
                      </div>
                    </div>
                    <div>
                      <div className="text-[#7D6C63]">بهای تمام‌شده کل</div>
                      <div className="font-extrabold text-[#C84B31] mt-0.5">
                        <PrivacyValue>{fmt(rm.totalCostPerKg)}</PrivacyValue>
                      </div>
                    </div>
                    <div>
                      <div className="text-[#7D6C63]">قیمت ویترین / سود خالص</div>
                      <div className="font-extrabold text-[#2D6A4F] mt-0.5">
                        {fmt(rm.storefrontPricePerKg)}{' '}
                        <span className="text-[11px]">
                          (<PrivacyValue>{formatPercent(rm.netMarginPct, usePersianDigits)}</PrivacyValue>)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[#7D6C63]">سود در ساعت فر / استادکار</div>
                      <div className="font-extrabold text-[#4338CA] mt-0.5">
                        <PrivacyValue>{fmt(rm.profitPerOvenHour, true)}</PrivacyValue> / فر
                      </div>
                    </div>
                  </div>

                  {/* 3-Tier Rounded Recommender + End-of-Day Recovery Floor */}
                  <div className="pt-3 border-t border-[#F2EBE2] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#6E5C54]">نرخ‌های رُند پیشنهادی:</span>
                      {(
                        [
                          { key: 'economy', label: 'اقتصادی', val: rm.recommendedPrices.economy },
                          { key: 'standard', label: 'استاندارد پیشنهادی', val: rm.recommendedPrices.standard },
                          { key: 'luxury', label: 'لوکس', val: rm.recommendedPrices.luxury },
                        ] as const
                      ).map((tier) => (
                        <button
                          key={tier.key}
                          type="button"
                          onClick={() => {
                            upsertRecipe({ ...raw, sellingPricePerKg: tier.val });
                            notify(`قیمت ویترین «${raw.name}» روی نرخ ${tier.label} تنظیم شد.`);
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold tabular-nums cursor-pointer transition-colors ${
                            tier.key === 'standard'
                              ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46] hover:bg-[#D1FAE5]'
                              : 'bg-[#FAF8F5] border-[#EAE2D8] text-[#4B3B34] hover:border-[#2B1E1A]'
                          }`}
                        >
                          {tier.label}: {fmt(tier.val)}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[#78350F] bg-[#FFFBEB] border border-[#F5D08A] rounded-lg px-2.5 py-1 tabular-nums">
                      <Moon className="w-3.5 h-3.5 text-[#D97706]" />
                      <span>کف حراج آخر شب:</span>
                      <strong>{fmt(rm.endOfDayFloorPrice)}</strong>
                      <HelpTip id="endOfDayFloor" />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'subrecipes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleAddSubRecipe}
            className="lg:col-span-4 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-3"
          >
            <h2 className="text-sm font-extrabold text-[#2B1E1A]">
              افزودن ماده نیمه‌ساخته جدید (کرم، شربت، گاناش)
            </h2>
            <div>
              <label className="block text-xs font-bold text-[#4B3B34] mb-1">نام نیمه‌ساخته</label>
              <input
                required
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="مثلاً: گاناش شکلات تلخ"
                className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4B3B34] mb-1">ماده اصلی تشکیل‌دهنده</label>
              <select
                value={newSubIngId}
                onChange={(e) => setNewSubIngId(e.target.value)}
                className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs"
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
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">مقدار ماده (گرم)</label>
                <LocaleNumberInput value={newSubIngAmt} onChange={setNewSubIngAmt} />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">وزن نهایی خروجی (گرم)</label>
                <LocaleNumberInput value={newSubYield} onChange={setNewSubYield} />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] cursor-pointer"
            >
              ثبت ماده نیمه‌ساخته
            </button>
          </form>

          <div className="lg:col-span-8 space-y-3">
            {data.subRecipes.map((sr) => {
              const costPerGram = summary.subRecipeUnitCosts[sr.id] ?? 0;
              return (
                <div
                  key={sr.id}
                  className="bg-white border border-[#EAE2D8] rounded-xl p-4 flex flex-wrap items-start justify-between gap-3"
                >
                  <div>
                    <h3 className="text-sm font-extrabold text-[#2B1E1A]">{sr.name}</h3>
                    <div className="text-xs text-[#6E5C54] mt-1 tabular-nums">
                      بازده هر پخت: {formatNumber(sr.yieldGrams, { usePersian: usePersianDigits })} گرم ·
                      بهای هر کیلو:{' '}
                      <strong className="text-[#2D6A4F]">
                        <PrivacyValue>{fmt(costPerGram * 1000)}</PrivacyValue>
                      </strong>
                    </div>
                    {sr.notes && <p className="text-[11px] text-[#7D6C63] mt-1">{sr.notes}</p>}
                  </div>
                  <button
                    type="button"
                    aria-label={`حذف ${sr.name}`}
                    onClick={() => deleteSubRecipe(sr.id)}
                    className="p-1.5 rounded-lg text-[#C84B31] hover:bg-[#FEF2F2] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'ab_lab' && <AbSwapLab />}
      {activeTab === 'chef_card' && <PrintableChefCard />}
      {activeTab === 'planner' && <HolidayProductionPlanner />}

      {editingRecipe && (
        <RecipeEditorModal
          initial={editingRecipe}
          onClose={() => setEditingRecipe(null)}
          onSave={(rec) => {
            upsertRecipe(rec);
            setEditingRecipe(null);
          }}
        />
      )}
    </div>
  );
};
