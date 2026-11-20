import React, { useMemo, useState } from 'react';
import {
  Cake,
  Coffee,
  Copy,
  Gift,
  Percent,
  Plus,
  Printer,
  Shield,
  Tag,
  Trash2,
} from 'lucide-react';
import { useWorkshop } from '../store/WorkshopContext';
import {
  computeCustomCakeQuote,
  computeDiscountRequiredVolumeIncreasePct,
  computeMixBoxMetrics,
} from '../utils/costEngine';
import {
  formatCurrency,
  formatDigits,
  formatNumber,
  formatPercent,
  roundToStep,
} from '../utils/formatters';
import { HelpTip } from '../components/HelpTip';
import { GuidedBanner } from '../components/GuidedBanner';
import { LocaleNumberInput } from '../components/LocaleNumberInput';
import { PrivacyValue } from '../components/PrivacyValue';

type CommercialTab = 'cake' | 'mixbox' | 'defense' | 'pricelist';

export const Pillar4Commercial: React.FC = () => {
  const { data, summary, updateCustomCake, updateMixBox, notify } = useWorkshop();
  const { currencyUnit, usePersianDigits } = data.settings;
  const fmt = (v: number, compact = false) =>
    formatCurrency(v, currencyUnit, usePersianDigits, compact);

  const [activeTab, setActiveTab] = useState<CommercialTab>('cake');

  // Discount Trap local state
  const [discountPct, setDiscountPct] = useState<number>(15);
  const [basketAmount, setBasketAmount] = useState<number>(850_000);
  const [cafeSelectedRecipeId, setCafeSelectedRecipeId] = useState<string>(
    data.recipes.find((r) => r.category === 'کافه‌ای')?.id ?? data.recipes[0]?.id ?? ''
  );

  // 4A Custom Cake Calculation
  const cakeQuote = useMemo(
    () => computeCustomCakeQuote(data.customCake, data, summary),
    [data, summary]
  );

  const whatsappCakeMessage = useMemo(() => {
    const c = data.customCake;
    return `سلام ${c.customerName || 'مشتری گرامی'} عزیز 🌷
پیش‌فاکتور سفارش اختصاصی از «${data.settings.workshopName}»:

🎂 عنوان سفارش: ${c.title}
⚖️ وزن تقریبی: ${formatNumber(c.weightKg, { decimals: 1, usePersian: true })} کیلوگرم
📅 تاریخ تحویل: ${c.deliveryDateShamsi || 'هماهنگی در کارگاه'}
💰 مبلغ نهایی کل: ${fmt(cakeQuote.finalQuote)}
💳 بیعانه جهت قطعی شدن سفارش (${formatDigits(c.depositPct, true)}٪): ${fmt(cakeQuote.depositAmount)}

جهت ثبت نهایی و رزرو نوبت تزیین، لطفاً رسید بیعانه را ارسال فرمایید.
${data.settings.phone ? `📞 تماس: ${data.settings.phone}` : ''} ${
      data.settings.instagram ? `| اینستاگرام: ${data.settings.instagram}` : ''
    }`;
  }, [data.customCake, data.settings, cakeQuote]);

  // 4B Mix Box Calculation
  const mixMetrics = useMemo(
    () => computeMixBoxMetrics(data.mixBox, data, summary),
    [data, summary]
  );

  // 4C Discount Trap & Smart Basket Gift
  const discountTrap = useMemo(
    () => computeDiscountRequiredVolumeIncreasePct(summary.blendedNetMarginPct, discountPct),
    [summary.blendedNetMarginPct, discountPct]
  );

  const giftSuggestion = useMemo(() => {
    // 200g dry pastry gift costs ~3.5-4.5% of basket
    const dryRecipe =
      summary.recipeMetrics.find((r) => r.category === 'خشک') ?? summary.recipeMetrics[0];
    const giftCost = dryRecipe ? dryRecipe.totalCostPerKg * 0.2 : 35000;
    const giftCostPct = basketAmount > 0 ? (giftCost / basketAmount) * 100 : 4;
    const cashDiscountCost = basketAmount * (discountPct / 100);
    return {
      giftName: dryRecipe ? `۲۰۰ گرم ${dryRecipe.name} هدیه` : '۲۰۰ گرم شیرینی خشک ویژه',
      giftCost,
      giftCostPct,
      savedVsDiscount: Math.max(0, cashDiscountCost - giftCost),
    };
  }, [summary.recipeMetrics, basketAmount, discountPct]);

  // B2B Cafe Tiered Contract
  const cafeTiers = useMemo(() => {
    const rm =
      summary.recipeMetrics.find((r) => r.recipeId === cafeSelectedRecipeId) ??
      summary.recipeMetrics[0];
    if (!rm) return [];
    const tiers = [
      { label: 'پله ۱ — کافه بوتیک', weeklyKg: 10, discount: 10 },
      { label: 'پله ۲ — کافه پرتردد', weeklyKg: 30, discount: 14 },
      { label: 'پله ۳ — مجموعه زنجیره‌ای', weeklyKg: 60, discount: 18 },
    ];
    return tiers.map((t) => {
      const price = roundToStep(
        rm.storefrontPricePerKg * (1 - t.discount / 100),
        data.settings.priceRoundingStep
      );
      const profitPerKg = price - rm.totalCostPerKg;
      const marginPct = price > 0 ? (profitPerKg / price) * 100 : 0;
      return {
        ...t,
        productName: rm.name,
        price,
        profitPerKg,
        marginPct,
        monthlyProfit: profitPerKg * t.weeklyKg * 4.3,
        safe: marginPct >= data.settings.redFlagMarginPct,
      };
    });
  }, [summary.recipeMetrics, cafeSelectedRecipeId, data.settings]);

  // 4D WhatsApp / Instagram Formatted Price List
  const socialPriceList = useMemo(() => {
    const lines = summary.recipeMetrics.map(
      (r) => `▪️ ${r.name} (هر کیلو): ${fmt(r.storefrontPricePerKg)}`
    );
    return `✨ لیست قیمت روز «${data.settings.workshopName}» ✨\n\n${lines.join('\n')}\n\n📦 وزن جعبه طبق قانون اتحادیه محاسبه نمی‌شود.\n${
      data.settings.phone ? `📞 ثبت سفارش: ${data.settings.phone}\n` : ''
    }${data.settings.instagram ? `📲 اینستاگرام: ${data.settings.instagram}` : ''}`;
  }, [summary.recipeMetrics, data.settings]);

  const copyText = async (txt: string, label: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      notify(`${label} در حافظه کپی شد.`);
    } catch {
      notify('متن آماده انتخاب و کپی دستی است.', 'info');
    }
  };

  return (
    <div>
      <div className="no-print mb-4">
        <h1 className="text-xl font-extrabold text-[#2B1E1A]">
          موتور درآمدزایی، قیمت‌گذاری سفارشی و دفاع از حاشیه سود
        </h1>
        <p className="text-xs text-[#7D6C63] mt-0.5">
          کیک فوندانت با دستمزد دکوراتور، پک‌های میکس مناسبتی، سپر نرخ اسنپ‌فود، قرارداد کافه و اتیکت چاپی ویترین
        </p>
      </div>

      {/* Sub-Tabs */}
      <div
        role="tablist"
        aria-label="ابزارهای درآمدزایی و فروش"
        className="no-print mb-5 flex flex-wrap gap-1.5 bg-white border border-[#EAE2D8] rounded-xl p-1.5"
      >
        {[
          { id: 'cake' as const, label: '۴A. کیک سفارشی و فوندانت', icon: Cake },
          { id: 'mixbox' as const, label: '۴B. پک میکس و جعبه مناسبتی', icon: Gift },
          { id: 'defense' as const, label: '۴C. اسنپ‌فود، کافه B2B و تله تخفیف', icon: Shield },
          { id: 'pricelist' as const, label: '۴D. لیست قیمت واتساپ و اتیکت ویترین', icon: Tag },
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

      {activeTab === 'cake' && (
        <div className="space-y-4">
          <GuidedBanner text="ساعت کار دکوراتور و پیچیدگی تزیین فوندانت را دقیق وارد کنید تا قیمت نهایی و پیام آماده واتساپ مشتری در لحظه ساخته شود." />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Inputs */}
            <div className="xl:col-span-7 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
                مشخصات فنی و هنری کیک سفارشی
                <HelpTip id="customCake" />
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">عنوان سفارش</label>
                  <input
                    type="text"
                    value={data.customCake.title}
                    onChange={(e) => updateCustomCake({ ...data.customCake, title: e.target.value })}
                    className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">نام مشتری</label>
                  <input
                    type="text"
                    value={data.customCake.customerName}
                    onChange={(e) =>
                      updateCustomCake({ ...data.customCake, customerName: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">کیک پایه</label>
                  <select
                    value={data.customCake.baseRecipeId}
                    onChange={(e) =>
                      updateCustomCake({ ...data.customCake, baseRecipeId: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs"
                  >
                    {data.recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">وزن کیک (کیلوگرم)</label>
                  <LocaleNumberInput
                    value={data.customCake.weightKg}
                    onChange={(v) => updateCustomCake({ ...data.customCake, weightKg: v })}
                    suffix="کیلو"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">مصرف فوندانت (کیلو)</label>
                  <LocaleNumberInput
                    value={data.customCake.fondantKg}
                    onChange={(v) => updateCustomCake({ ...data.customCake, fondantKg: v })}
                    suffix="کیلو"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">گاناش و فیلینگ/کیلو</label>
                  <LocaleNumberInput
                    value={data.customCake.ganacheCostPerKg}
                    onChange={(v) => updateCustomCake({ ...data.customCake, ganacheCostPerKg: v })}
                    suffix="تومان"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">تاپر، گل طبیعی و تزیینات</label>
                  <LocaleNumberInput
                    value={data.customCake.topperAndFlowersCost}
                    onChange={(v) =>
                      updateCustomCake({ ...data.customCake, topperAndFlowersCost: v })
                    }
                    suffix="تومان"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">زیرکیکی و جعبه بلند</label>
                  <LocaleNumberInput
                    value={data.customCake.boardAndTallBoxCost}
                    onChange={(v) =>
                      updateCustomCake({ ...data.customCake, boardAndTallBoxCost: v })
                    }
                    suffix="تومان"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">ساعت کار دکوراتور</label>
                  <LocaleNumberInput
                    value={data.customCake.decoratorHours}
                    onChange={(v) => updateCustomCake({ ...data.customCake, decoratorHours: v })}
                    suffix="ساعت"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">دستمزد هر ساعت دکوراتور</label>
                  <LocaleNumberInput
                    value={data.customCake.decoratorHourlyRate}
                    onChange={(v) =>
                      updateCustomCake({ ...data.customCake, decoratorHourlyRate: v })
                    }
                    suffix="تومان"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">ضریب پیچیدگی طراحی (%)</label>
                  <LocaleNumberInput
                    value={data.customCake.complexitySurchargePct}
                    onChange={(v) =>
                      updateCustomCake({ ...data.customCake, complexitySurchargePct: v })
                    }
                    suffix="٪"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">حاشیه سود هدف (%)</label>
                  <LocaleNumberInput
                    value={data.customCake.targetMarginPct}
                    onChange={(v) => updateCustomCake({ ...data.customCake, targetMarginPct: v })}
                    suffix="٪"
                  />
                </div>
              </div>
            </div>

            {/* Output Quote + WhatsApp Message */}
            <div className="xl:col-span-5 space-y-4">
              <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-5 space-y-3">
                <div className="text-xs font-bold text-[#065F46]">قیمت نهایی پیشنهادی (رُندشده):</div>
                <div className="text-3xl font-extrabold text-[#1B4332] tabular-nums">
                  {fmt(cakeQuote.finalQuote)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#A7F3D0]/70 tabular-nums">
                  <div>
                    بیعانه پیشنهادی ({formatDigits(data.customCake.depositPct, usePersianDigits)}٪):{' '}
                    <strong className="text-[#1B4332]">{fmt(cakeQuote.depositAmount)}</strong>
                  </div>
                  <div>
                    بهای تمام‌شده کل:{' '}
                    <strong>
                      <PrivacyValue>{fmt(cakeQuote.totalCost)}</PrivacyValue>
                    </strong>
                  </div>
                  <div>
                    دستمزد دکوراتور: <strong>{fmt(cakeQuote.decoratorLaborCost)}</strong>
                  </div>
                  <div>
                    سود خالص سفارش:{' '}
                    <strong className="text-[#2D6A4F]">
                      <PrivacyValue>
                        {fmt(cakeQuote.netProfit)} ({formatPercent(cakeQuote.actualMarginPct, usePersianDigits)})
                      </PrivacyValue>
                    </strong>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#EAE2D8] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#2B1E1A]">
                    پیش‌نمایش پیام حرفه‌ای واتساپ مشتری
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(whatsappCakeMessage, 'پیام پیش‌فاکتور واتساپ')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold hover:bg-[#23553F] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>کپی پیام حرفه‌ای واتساپ</span>
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed bg-[#FAF8F5] border border-[#EFE7DC] rounded-lg p-3 text-[#2B1E1A]">
                  {whatsappCakeMessage}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mixbox' && (
        <div className="space-y-4">
          <GuidedBanner text="ترکیب چند شیرینی خشک و ویژه در یک جعبه کادویی، بهترین راه قانونی برای عبور از فشردگی نرخ اتحادیه و افزایش سود هر فاکتور است." />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center">
                  مهندسی پک میکس و جعبه مناسبتی
                  <HelpTip id="mixBox" />
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    const firstRec = data.recipes[0]?.id;
                    if (!firstRec) return;
                    updateMixBox({
                      ...data.mixBox,
                      items: [...data.mixBox.items, { recipeId: firstRec, grams: 300 }],
                    });
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن شیرینی به پک</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">نام پک کادویی</label>
                  <input
                    type="text"
                    value={data.mixBox.name}
                    onChange={(e) => updateMixBox({ ...data.mixBox, name: e.target.value })}
                    className="w-full rounded-lg border border-[#EAE2D8] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">حاشیه سود هدف (%)</label>
                  <LocaleNumberInput
                    value={data.mixBox.targetMarginPct}
                    onChange={(v) => updateMixBox({ ...data.mixBox, targetMarginPct: v })}
                    suffix="٪"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">هزینه جعبه کادویی</label>
                  <LocaleNumberInput
                    value={data.mixBox.boxCost}
                    onChange={(v) => updateMixBox({ ...data.mixBox, boxCost: v })}
                    suffix="تومان"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">روبان، کارت و پاکت</label>
                  <LocaleNumberInput
                    value={data.mixBox.ribbonAndCardCost}
                    onChange={(v) => updateMixBox({ ...data.mixBox, ribbonAndCardCost: v })}
                    suffix="تومان"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">زمان چیدمان (دقیقه)</label>
                  <LocaleNumberInput
                    value={data.mixBox.laborMinutes}
                    onChange={(v) => updateMixBox({ ...data.mixBox, laborMinutes: v })}
                    suffix="دقیقه"
                  />
                </div>
              </div>

              {/* Mix Items */}
              <div className="space-y-2 pt-2 border-t border-[#F2EBE2]">
                {data.mixBox.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <select
                      value={item.recipeId}
                      onChange={(e) => {
                        const next = data.mixBox.items.map((x, i) =>
                          i === idx ? { ...x, recipeId: e.target.value } : x
                        );
                        updateMixBox({ ...data.mixBox, items: next });
                      }}
                      className="col-span-7 rounded-lg border border-[#EAE2D8] bg-white px-2.5 py-2 text-xs font-semibold"
                    >
                      {data.recipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <div className="col-span-4">
                      <LocaleNumberInput
                        value={item.grams}
                        onChange={(v) => {
                          const next = data.mixBox.items.map((x, i) =>
                            i === idx ? { ...x, grams: v } : x
                          );
                          updateMixBox({ ...data.mixBox, items: next });
                        }}
                        suffix="گرم"
                      />
                    </div>
                    <button
                      type="button"
                      aria-label="حذف آیتم از پک"
                      onClick={() =>
                        updateMixBox({
                          ...data.mixBox,
                          items: data.mixBox.items.filter((_, i) => i !== idx),
                        })
                      }
                      className="col-span-1 p-1.5 text-[#C84B31] hover:bg-[#FEF2F2] rounded-lg flex justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:col-span-5 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] p-4">
                <div className="text-xs font-bold text-[#065F46]">قیمت رُند پیشنهادی پک ({formatNumber(mixMetrics.totalGrams, { usePersian: usePersianDigits })} گرم):</div>
                <div className="text-3xl font-extrabold text-[#1B4332] tabular-nums mt-1">
                  {fmt(mixMetrics.recommendedPrice)}
                </div>
                <div className="text-xs text-[#2D6A4F] font-bold mt-2 tabular-nums">
                  جهش سود نسبت به فروش تکی همین مقدار:{' '}
                  <PrivacyValue>
                    {mixMetrics.profitBoostVsSingle >= 0 ? '+' : ''}
                    {fmt(mixMetrics.profitBoostVsSingle)}
                  </PrivacyValue>
                </div>
              </div>

              <div className="space-y-2 text-xs tabular-nums">
                <div className="flex justify-between py-1.5 border-b border-[#F2EBE2]">
                  <span className="text-[#6E5C54]">بهای تمام‌شده شیرینی‌های داخل پک</span>
                  <strong className="text-[#2B1E1A]"><PrivacyValue>{fmt(mixMetrics.pastryCost)}</PrivacyValue></strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F2EBE2]">
                  <span className="text-[#6E5C54]">جعبه کادویی + روبان + چیدمان</span>
                  <strong className="text-[#2B1E1A]">{fmt(mixMetrics.packagingCost + mixMetrics.laborCost)}</strong>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#F2EBE2]">
                  <span className="text-[#6E5C54]">بهای تمام‌شده کل پک</span>
                  <strong className="text-[#C84B31]"><PrivacyValue>{fmt(mixMetrics.totalCost)}</PrivacyValue></strong>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[#6E5C54]">سود خالص هر پک ({formatPercent(mixMetrics.marginPct, usePersianDigits)})</span>
                  <strong className="text-[#2D6A4F]"><PrivacyValue>{fmt(mixMetrics.netProfit)}</PrivacyValue></strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'defense' && (
        <div className="space-y-5">
          <GuidedBanner text="نرخ محافظت‌شده اسنپ‌فود را برای جلوگیری از زیان کمیسیون کپی کنید، قرارداد کافه‌ها را پلکانی ببندید و از تله تخفیف نقدی دوری کنید." />

          {/* SnappFood Shield Table */}
          <section className="bg-white border border-[#EAE2D8] rounded-xl p-5">
            <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5 mb-3">
              <Shield className="w-4.5 h-4.5 text-[#2D6A4F]" />
              <span>سپر محافظ سود در اسنپ‌فود و تپسی‌فود</span>
              <HelpTip id="snappfoodShield" />
            </h2>
            <p className="text-xs text-[#7D6C63] mb-3">
              با فرض کمیسیون {formatPercent(data.settings.defaultSnappfoodCommissionPct, usePersianDigits, 0)} و هزینه جعبه پیک{' '}
              {fmt(data.settings.snappfoodExtraBoxCost)}؛ قیمت پیشنهادی زیر سود خالص شما را دقیقاً برابر ویترین حفظ می‌کند.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE2D8] text-[#6E5C54]">
                    <th className="py-2.5 px-3 font-bold">محصول</th>
                    <th className="py-2.5 px-3 font-bold">قیمت ویترین</th>
                    <th className="py-2.5 px-3 font-bold">قیمت فعلی اسنپ‌فود</th>
                    <th className="py-2.5 px-3 font-bold">نرخ سپر پیشنهادی (حفظ ۱۰۰٪ سود)</th>
                    <th className="py-2.5 px-3 font-bold">اختلاف محافظت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3ECE4]">
                  {summary.recipeMetrics.map((rm) => {
                    const snappCh = rm.channels.find((c) => c.channel === 'snappfood');
                    const currSnapp = snappCh?.effectivePricePerKg ?? rm.storefrontPricePerKg;
                    const gap = rm.snappfoodShieldPrice - currSnapp;
                    return (
                      <tr key={rm.recipeId} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 px-3 font-bold text-[#2B1E1A]">{rm.name}</td>
                        <td className="py-2.5 px-3 tabular-nums">{fmt(rm.storefrontPricePerKg)}</td>
                        <td className="py-2.5 px-3 tabular-nums text-[#6E5C54]">{fmt(currSnapp)}</td>
                        <td className="py-2.5 px-3 tabular-nums font-extrabold text-[#2D6A4F]">
                          {fmt(rm.snappfoodShieldPrice)}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums font-bold">
                          {gap > 0 ? (
                            <span className="text-[#C84B31]">کمبود +{fmt(gap)}</span>
                          ) : (
                            <span className="text-[#2D6A4F]">محافظت‌شده</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Bottom Grid: B2B Cafe Tiered Contract + Discount Trap Simulator */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Cafe B2B Tiered Builder */}
            <section className="xl:col-span-6 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
                  <Coffee className="w-4.5 h-4.5 text-[#D97706]" />
                  <span>سازنده قرارداد پلکانی کافه و هتل (B2B)</span>
                </h2>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B3B34] mb-1">انتخاب محصول قرارداد عمده:</label>
                <select
                  value={cafeSelectedRecipeId}
                  onChange={(e) => setCafeSelectedRecipeId(e.target.value)}
                  className="w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-xs font-semibold"
                >
                  {data.recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                {cafeTiers.map((t) => (
                  <div
                    key={t.label}
                    className={`rounded-xl border p-3.5 ${
                      t.safe ? 'bg-[#FAF8F5] border-[#EAE2D8]' : 'bg-[#FEF2F2] border-[#F5C2B8]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span>
                        {t.label} ({formatDigits(t.weeklyKg, usePersianDigits)} کیلو/هفته)
                      </span>
                      <span className="text-[#2D6A4F] tabular-nums">{fmt(t.price)} / کیلو</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#5A4A42] tabular-nums">
                      <span>تخفیف نسبت به ویترین: {formatDigits(t.discount, usePersianDigits)}٪</span>
                      <span>
                        سود ماهانه قرارداد:{' '}
                        <strong className={t.safe ? 'text-[#2D6A4F]' : 'text-[#C84B31]'}>
                          <PrivacyValue>
                            {fmt(t.monthlyProfit, true)} ({formatPercent(t.marginPct, usePersianDigits)})
                          </PrivacyValue>
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Discount Trap vs Smart Basket Gift */}
            <section className="xl:col-span-6 bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-4">
              <h2 className="text-base font-extrabold text-[#2B1E1A] flex items-center gap-1.5">
                <Percent className="w-4.5 h-4.5 text-[#C84B31]" />
                <span>شبیه‌ساز تله تخفیف در برابر هدیه هوشمند سبد خرید</span>
                <HelpTip id="discountTrap" />
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">درصد تخفیف درخواستی (%)</label>
                  <LocaleNumberInput value={discountPct} onChange={setDiscountPct} min={1} max={50} suffix="٪" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B3B34] mb-1">میانگین سبد خرید مشتری</label>
                  <LocaleNumberInput value={basketAmount} onChange={setBasketAmount} suffix="تومان" />
                </div>
              </div>

              <div className="rounded-xl bg-[#FEF2F2] border border-[#F5C2B8] p-4 text-xs space-y-1">
                <div className="font-extrabold text-[#991B1B]">
                  هشدار تله تخفیف ({formatDigits(discountPct, usePersianDigits)}٪ تخفیف نقدی):
                </div>
                {discountTrap.impossible ? (
                  <p className="text-[#991B1B]">
                    این تخفیف از حاشیه سود فعلی منو ({formatPercent(summary.blendedNetMarginPct, usePersianDigits)}) بیشتر است و هر فروش بیشتر زیان را بزرگ‌تر می‌کند!
                  </p>
                ) : (
                  <p className="text-[#7F1D1D] leading-relaxed">
                    برای اینکه سودتان فقط ثابت بماند، باید فروشتان را{' '}
                    <strong className="text-sm underline tabular-nums">
                      +{formatPercent(discountTrap.requiredVolumeIncreasePct, usePersianDigits, 0)}
                    </strong>{' '}
                    افزایش دهید!
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] p-4 text-xs space-y-1.5">
                <div className="font-extrabold text-[#065F46]">
                  جایگزین طلایی: «هدیه هوشمند روی سبد خرید»
                </div>
                <p className="text-[#1B4332] leading-relaxed">
                  به جای تخفیف نقدی، روی سبدهای بالای {fmt(basketAmount)} یک بسته{' '}
                  <strong>{giftSuggestion.giftName}</strong> هدیه بدهید. هزینه واقعی برای شما فقط{' '}
                  <strong className="tabular-nums">
                    {fmt(giftSuggestion.giftCost)} ({formatPercent(giftSuggestion.giftCostPct, usePersianDigits)})
                  </strong>{' '}
                  است و در هر فاکتور{' '}
                  <strong className="tabular-nums">{fmt(giftSuggestion.savedVsDiscount)}</strong> سود بیشتری حفظ می‌کنید!
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'pricelist' && (
        <div className="space-y-5">
          <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-white border border-[#EAE2D8] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[#2B1E1A]">
                  متن آماده لیست قیمت واتساپ و اینستاگرام
                </h2>
                <button
                  type="button"
                  onClick={() => copyText(socialPriceList, 'لیست قیمت واتساپ/اینستاگرام')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D6A4F] text-white text-xs font-bold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>کپی ۱ کلیکی لیست قیمت</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed bg-[#FAF8F5] border border-[#EAE2D8] rounded-xl p-4 text-[#2B1E1A]">
                {socialPriceList}
              </pre>
            </section>

            <section className="bg-white border border-[#EAE2D8] rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-[#2B1E1A]">
                  چاپ اتیکت‌های برندشده ویترین (آماده برش A4)
                </h2>
                <p className="text-xs text-[#7D6C63] mt-1 leading-relaxed">
                  کارت‌های زیر به صورت خودکار با نام قنادی، قیمت به‌روز هر کیلو و نشان رعایت قانون کسر وزن جعبه آماده چاپ روی کاغذ مقوایی هستند.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2B1E1A] text-white text-xs font-bold hover:bg-[#3E2D27] cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ اتیکت‌های ویترین</span>
              </button>
            </section>
          </div>

          {/* Printable Branded Showcase Tags */}
          <div className="print-container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.recipeMetrics.map((rm) => (
              <div
                key={rm.recipeId}
                className="print-break-inside-avoid bg-white border-2 border-[#2B1E1A] rounded-2xl p-4 text-center flex flex-col justify-between min-h-[155px]"
              >
                <div className="text-[11px] font-bold text-[#7D6C63] border-b border-[#EAE2D8] pb-1.5">
                  {data.settings.workshopName}
                </div>
                <div className="my-2">
                  <div className="text-base font-extrabold text-[#2B1E1A]">{rm.name}</div>
                  <div className="text-[11px] text-[#7D6C63] mt-0.5">{rm.category}</div>
                </div>
                <div className="pt-2 border-t border-[#EAE2D8]">
                  <div className="text-lg font-extrabold text-[#2D6A4F] tabular-nums">
                    {fmt(rm.storefrontPricePerKg)}
                  </div>
                  <div className="text-[10px] text-[#8C7B72]">هر کیلوگرم · بدون احتساب وزن جعبه</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
