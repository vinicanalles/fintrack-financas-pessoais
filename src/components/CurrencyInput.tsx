import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export function CurrencyInput({ value, onChange, className, placeholder, required }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  const format = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  useEffect(() => {
    // Update display value when external value changes
    setDisplayValue(format(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove everything except digits
    const digits = e.target.value.replace(/\D/g, '');
    
    // Convert to number (treating last 2 digits as cents)
    const numericValue = parseFloat(digits) / 100;
    
    // Prevent negative values (though replace(/\D/g, '') already does this)
    if (isNaN(numericValue)) {
      onChange(0);
    } else {
      onChange(numericValue);
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      className={cn(
        "w-full px-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-stone-900 dark:text-stone-50",
        className
      )}
      placeholder={placeholder || "R$ 0,00"}
      required={required}
    />
  );
}
