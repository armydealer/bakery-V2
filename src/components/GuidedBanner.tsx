import React from 'react';
import { Lightbulb } from 'lucide-react';
import { useWorkshop } from '../store/WorkshopContext';

export const GuidedBanner: React.FC<{ text: string }> = ({ text }) => {
  const { data } = useWorkshop();
  if (!data.settings.guidedLearningMode) return null;

  return (
    <div className="no-print mb-4 flex items-center gap-2.5 rounded-xl border border-[#F3D79B] bg-[#FFFBEB] px-4 py-2.5 text-xs text-[#78350F]">
      <Lightbulb className="w-4 h-4 text-[#D97706] shrink-0" />
      <span className="font-semibold shrink-0">در این صفحه چه کاری انجام دهید؟</span>
      <span className="text-[#5C3A14]">{text}</span>
    </div>
  );
};
