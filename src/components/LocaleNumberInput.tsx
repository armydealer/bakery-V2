import React, { useEffect, useState } from 'react';
import { formatDigits, parseLocaleNumber } from '../utils/formatters';
import { useWorkshop } from '../store/WorkshopContext';

interface LocaleNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
  allowNegative?: boolean;
  suffix?: string;
}

export const LocaleNumberInput: React.FC<LocaleNumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  placeholder,
  className = '',
  id,
  ariaLabel,
  allowNegative = false,
  suffix,
}) => {
  const { data } = useWorkshop();
  const usePersian = data.settings.usePersianDigits;
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() =>
    formatDigits(Number.isFinite(value) ? String(value) : '0', usePersian)
  );

  useEffect(() => {
    if (!focused) {
      const formatted = Number.isFinite(value)
        ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value)
        : '0';
      setText(formatDigits(formatted, usePersian));
    }
  }, [value, focused, usePersian]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    if (raw.trim() === '' || raw === '-' || raw === '.') {
      return;
    }
    let parsed = parseLocaleNumber(raw);
    if (!allowNegative && parsed < 0) parsed = 0;
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;
    onChange(parsed);
  };

  const handleBlur = () => {
    setFocused(false);
    let parsed = parseLocaleNumber(text);
    if (!allowNegative && parsed < 0) parsed = 0;
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;
    onChange(parsed);
    const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(parsed);
    setText(formatDigits(formatted, usePersian));
  };

  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={text}
        placeholder={placeholder}
        onFocus={() => {
          setFocused(true);
          setText(String(Number.isFinite(value) ? value : 0));
        }}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-full rounded-lg border border-[#EAE2D8] bg-white px-3 py-2 text-sm text-[#2B1E1A] tabular-nums focus:border-[#2D6A4F] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/15 transition-colors ${
          suffix ? 'pl-14' : ''
        } ${className}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute left-2.5 text-[11px] text-[#7D6C63] select-none">
          {suffix}
        </span>
      )}
    </div>
  );
};
