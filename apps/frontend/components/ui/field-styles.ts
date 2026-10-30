// The focus treatment Input/Select/Textarea use, for the few native controls that can't be one of
// those components (split month/year selects, a country-code select fused to a phone input, a
// search bar's bare input). Keeps keyboard focus visible everywhere with one look.

/** On the control itself. */
export const FIELD_FOCUS = 'focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/[0.08]';

/** Same, for a control in an error state. */
export const FIELD_FOCUS_ERROR = 'focus:border-error focus:outline-none focus:ring-[3px] focus:ring-error/[0.08]';

/**
 * On a bordered wrapper around borderless inner controls (they keep `outline-none`): the wrapper
 * shows the ring while any child has focus.
 */
export const FIELD_FOCUS_WITHIN = 'focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/[0.08]';
