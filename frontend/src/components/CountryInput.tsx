import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { GameConfig } from '../lib/config';
import { findSuggestions, normalizeCountryInput } from '../lib/countries';
import type { RoundOption } from '../lib/types';

interface CountryInputProps {
  onSubmit: (code: string) => void;
  disabled?: boolean;
}

interface FormValues {
  country: string;
}

export function CountryInput({ onSubmit, disabled = false }: CountryInputProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { country: '' },
  });

  const [suggestions, setSuggestions] = useState<RoundOption[]>([]);
  const countryValue = watch('country');

  useEffect(() => {
    if (!countryValue) {
      setSuggestions(findSuggestions('', 5));
    } else {
      setSuggestions(findSuggestions(countryValue, 5));
      if (countryValue.length >= GameConfig.hardMinLetters) {
        clearErrors('country');
      }
    }
  }, [countryValue, clearErrors]);

  const hint = useMemo(() => {
    if (!countryValue) return 'Type the country name';
    if (countryValue.length < GameConfig.hardMinLetters) {
      return `Type at least ${GameConfig.hardMinLetters} letters`;
    }
    return 'Tap a suggestion or press Enter';
  }, [countryValue]);

  const onSubmitForm = (data: FormValues) => {
    if (!data.country) {
      setError('country', { type: 'manual', message: 'Enter a country' });
      return;
    }
    const normalized = normalizeCountryInput(data.country);
    if (!normalized) {
      setError('country', { type: 'manual', message: 'Oops, try another name' });
      return;
    }
    onSubmit(normalized);
    reset();
  };

  const handleSuggestion = (option: RoundOption) => {
    setValue('country', option.name, { shouldDirty: true, shouldTouch: true });
    const normalized = normalizeCountryInput(option.name);
    if (normalized) {
      onSubmit(normalized);
      reset();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)} className="w-full flex flex-col gap-4 mt-6">
      <label className="text-xl font-semibold" htmlFor="country">
        Which country is this crossing in?
      </label>
      <input
        id="country"
        type="text"
        autoComplete="off"
        className="w-full rounded-3xl px-6 py-4 text-2xl text-dark bg-white shadow focus:outline-none focus:ring-4 focus:ring-secondary"
        placeholder="Start typing..."
        disabled={disabled}
        {...register('country')}
      />
      <div className="text-lg opacity-80">{hint}</div>
      {errors.country && <div className="text-red-200 text-lg">{errors.country.message}</div>}
      <div className="flex flex-wrap gap-3">
        {suggestions.map((option) => (
          <button
            key={option.code}
            type="button"
            onClick={() => handleSuggestion(option)}
            className="px-4 py-2 rounded-full bg-white/80 text-dark text-lg font-bold shadow hover:-translate-y-1 transition"
            disabled={disabled}
          >
            {option.name}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="self-start mt-4 bg-secondary text-dark font-extrabold text-xl px-6 py-3 rounded-full shadow hover:-translate-y-1 transition disabled:opacity-60"
      >
        Guess!
      </button>
    </form>
  );
}
