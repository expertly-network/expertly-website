import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

/** Per-field error messages keyed by field id, shared by the wizard steps and the admin editor. */
export function useFieldErrors(): {
  errors: Record<string, string>;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
  clearErrors: (fields: string[]) => void;
} {
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Clears one or more field errors as soon as their value changes, instead of leaving a stale
  // red border/message on screen until the next full-form validation pass.
  const clearErrors = useCallback((fields: string[]) => {
    setErrors((prev) => {
      if (!fields.some((f) => f in prev)) return prev;
      const next = { ...prev };
      for (const f of fields) delete next[f];
      return next;
    });
  }, []);

  return { errors, setErrors, clearErrors };
}
