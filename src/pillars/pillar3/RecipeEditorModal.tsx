import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Recipe, RecipeLineItem } from '../../types';
import { useWorkshop } from '../../store/WorkshopContext';
import { LocaleNumberInput } from '../../components/LocaleNumberInput';
import { HelpTip } from '../../components/HelpTip';

interface RecipeEditorModalProps {
  initial: Recipe;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
}

export const RecipeEditorModal: React.FC<RecipeEditorModalProps> = ({
  initial,
  onClose,
  onSave,
}) => {
  const { data } = useWorkshop();
  const [draft, setDraft] = useState<Recipe>(initial);

  const addLine = () => {
    const firstIng = data.ingredients[0]?.id ?? '';
    const next: RecipeLineItem = {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      kind: 'ingredient',
      refId: firstIng,
      amount: 500,
    };
    setDraft((p) => ({ ...p, items: [...p.items, next] }));
  };

  const updateLine = (id: string, patch: Partial<RecipeLineItem>) => {
    setDraft((p) => ({
      ...p,
      items: p.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeLine = (id: string) => {
    setDraft((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim() });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ویرایشگر فرمولاسیون شیرینی"
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#EAE2D8] rounded-2xl max-w-3xl w-full p-5 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#F2EBE2] pb-3">
          <h3 className="text-base font-extrabold text-[#2B1E1A]">
            تدوین و مهندسی فرمولاسیون محصول
          </h3>
          <button
            type="button"
            aria-label="بستن پنجره"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7D6C63] hover:bg-[#FAF8F5] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-[#4B3B34] mb-1">نام محصول *</label>
            <input
              required
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#4B3B34] mb-1">دسته‌بندی</label>
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value as Recipe['category'] })
              }
              className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs bg-white"
            >
              <option value="خشک">خشک</option>
              <option value="تر و خامه‌ای">تر و خامه‌ای</option>
              <option value="سنتی و باقلوا">سنتی و باقلوا</option>
              <option value="کافه‌ای">کافه‌ای</option>
            </select>
          </div>
        </div>

        {/* Formula Items */}
        <div className="bg-[#FAF8F5] border border-[#EAE2D8] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#2B1E1A]">
              ترکیبات یک پخت کامل (مواد اولیه و مواد نیمه‌ساخته)
            </span>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2D6A4F] text-white text-[11px] font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              افزودن ردیف
            </button>
          </div>

          <div className="space-y-2">
            {draft.items.map((line) => (
              <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={line.kind}
                  onChange={(e) => {
                    const nextKind = e.target.value as 'ingredient' | 'subRecipe';
                    const fallbackId =
                      nextKind === 'ingredient'
                        ? data.ingredients[0]?.id ?? ''
                        : data.subRecipes[0]?.id ?? '';
                    updateLine(line.id, { kind: nextKind, refId: fallbackId });
                  }}
                  className="col-span-3 rounded-lg border border-[#EAE2D8] bg-white px-2 py-2 text-xs"
                >
                  <option value="ingredient">ماده اولیه</option>
                  <option value="subRecipe" disabled={data.subRecipes.length === 0}>
                    نیمه‌ساخته
                  </option>
                </select>

                <select
                  value={line.refId}
                  onChange={(e) => updateLine(line.id, { refId: e.target.value })}
                  className="col-span-5 rounded-lg border border-[#EAE2D8] bg-white px-2 py-2 text-xs"
                >
                  {line.kind === 'ingredient'
                    ? data.ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.baseUnit === 'piece' ? 'عدد' : 'گرم'})
                        </option>
                      ))
                    : data.subRecipes.map((sr) => (
                        <option key={sr.id} value={sr.id}>
                          {sr.name} (گرم)
                        </option>
                      ))}
                </select>

                <div className="col-span-3">
                  <LocaleNumberInput
                    value={line.amount}
                    onChange={(v) => updateLine(line.id, { amount: v })}
                  />
                </div>

                <button
                  type="button"
                  aria-label="حذف ردیف ماده"
                  onClick={() => removeLine(line.id)}
                  className="col-span-1 p-1.5 text-[#C84B31] hover:bg-[#FEF2F2] rounded-lg flex justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Yield, Waste, Oven & Pricing Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">
              افت پخت / شربت (%) <HelpTip id="bakingChange" />
            </label>
            <LocaleNumberInput
              allowNegative
              value={draft.bakingChangePct}
              onChange={(v) => setDraft({ ...draft, bakingChangePct: v })}
              suffix="٪"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">پرت برش لبه (%)</label>
            <LocaleNumberInput
              value={draft.trimWastePct}
              onChange={(v) => setDraft({ ...draft, trimWastePct: v })}
              suffix="٪"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">بیاتی ویترین (%)</label>
            <LocaleNumberInput
              value={draft.shelfLifeSpoilagePct}
              onChange={(v) => setDraft({ ...draft, shelfLifeSpoilagePct: v })}
              suffix="٪"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">فروش ماهانه (کیلو)</label>
            <LocaleNumberInput
              value={draft.monthlySalesKg}
              onChange={(v) => setDraft({ ...draft, monthlySalesKg: v })}
              suffix="کیلو"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">زمان فر (دقیقه)</label>
            <LocaleNumberInput
              value={draft.ovenMinutesPerBatch}
              onChange={(v) => setDraft({ ...draft, ovenMinutesPerBatch: v })}
              suffix="دقیقه"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">تعداد سینی در پخت</label>
            <LocaleNumberInput
              value={draft.ovenTraysPerBatch}
              onChange={(v) => setDraft({ ...draft, ovenTraysPerBatch: v })}
              min={1}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">دمای فر (°C)</label>
            <LocaleNumberInput
              value={draft.ovenTempCelsius}
              onChange={(v) => setDraft({ ...draft, ovenTempCelsius: v })}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">زمان استادکار (دقیقه)</label>
            <LocaleNumberInput
              value={draft.directLaborMinutesPerBatch}
              onChange={(v) => setDraft({ ...draft, directLaborMinutesPerBatch: v })}
              suffix="دقیقه"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">قیمت ویترین/کیلو</label>
            <LocaleNumberInput
              value={draft.sellingPricePerKg}
              onChange={(v) => setDraft({ ...draft, sellingPricePerKg: v })}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">سقف اتحادیه (اختیاری)</label>
            <LocaleNumberInput
              value={draft.unionPriceCeiling ?? 0}
              onChange={(v) =>
                setDraft({ ...draft, unionPriceCeiling: v > 0 ? v : undefined })
              }
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">تخفیف کافه B2B (%)</label>
            <LocaleNumberInput
              value={draft.cafeDiscountPct}
              onChange={(v) => setDraft({ ...draft, cafeDiscountPct: v })}
              suffix="٪"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#4B3B34] mb-1">افزایش نرخ اسنپ‌فود (%)</label>
            <LocaleNumberInput
              value={draft.snappfoodMarkupPct}
              onChange={(v) => setDraft({ ...draft, snappfoodMarkupPct: v })}
              suffix="٪"
            />
          </div>
        </div>

        {/* Box & Packaging + Instructions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-[#4B3B34] mb-1">
              جعبه استاندارد (قانون کسر وزن جعبه) <HelpTip id="boxWeightLaw" />
            </label>
            <select
              value={draft.boxIngredientId}
              onChange={(e) => setDraft({ ...draft, boxIngredientId: e.target.value })}
              className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs bg-white"
            >
              {data.ingredients
                .filter((i) => i.category === 'packaging')
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#4B3B34] mb-1">
              هزینه کاغذ روغنی و ملزومات هر کیلو (تومان)
            </label>
            <LocaleNumberInput
              value={draft.extraPackagingCostPerKg}
              onChange={(v) => setDraft({ ...draft, extraPackagingCostPerKg: v })}
              suffix="تومان"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#4B3B34] mb-1">
            نکات فنی پخت (نمایش روی کارت پخت استادکار)
          </label>
          <textarea
            rows={2}
            value={draft.chefInstructions ?? ''}
            onChange={(e) => setDraft({ ...draft, chefInstructions: e.target.value })}
            className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F2EBE2]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#EAE2D8] text-xs font-bold text-[#5A4A42] cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] cursor-pointer"
          >
            ذخیره فرمولاسیون
          </button>
        </div>
      </form>
    </div>
  );
};
