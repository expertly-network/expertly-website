import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

// The 3 button treatments docs/design-system.md documents under "Color combination
// rules" — codified here so every call site gets them from one place instead of
// re-typing the class string (this consolidates what was previously duplicated,
// near-verbatim, across TopNav, the auth forms, and StepActions).
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'secondary-dark'
  | 'ghost-dark'
  | 'accent';
export type ButtonSize = 'md' | 'sm';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-bg hover:bg-ink-2',
  secondary: 'border border-line-2 bg-bg-card text-ink hover:border-ink',
  ghost: 'text-ink-2 hover:bg-bg-alt',
  // Dark-surface counterparts (hero, ink-colored cards, nav-green chrome) —
  // the `ink` family has no contrast there, so these use white/NN opacity
  // instead, per docs/design-system.md's "Dark surfaces" color rule.
  'secondary-dark': 'bg-bg text-ink hover:bg-white/90',
  'ghost-dark': 'border border-white/[0.14] text-white/55 hover:border-white/35 hover:text-bg-card',
  // The homepage hero's primary CTA — verified against the actual rendered design mockup
  // (not just its documented button rules) to genuinely be accent-green, a deliberate
  // one-off distinct from the rest of the app's bg-ink primary buttons.
  accent: 'border border-accent bg-accent text-bg hover:border-accent-2 hover:bg-accent-2',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'min-h-[48px] px-8',
  sm: 'min-h-[44px] px-6',
};

// rounded-input (10px) is the app-wide standard for every Button — matches what
// design/static_html itself uses for the vast majority of its buttons (its generic
// `.btn`/`.btn-lg` classes); only two specific spots there (the inline "Request
// Consultation" chip, filter/tag chips) are true pills, and those aren't worth a second
// Button shape for. (Briefly tried rounded-full app-wide instead — reverted per explicit
// direction: 10px reads cleaner for this audience than a full pill everywhere.)
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-input text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
}

function classes({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className = '',
}: Omit<CommonProps, 'children'>) {
  return `${BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`.trim();
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'> & { href: string };

// Renders a <button> by default; pass `href` to render a Next.js <Link> styled
// identically (e.g. TopNav's "Log in") — same visual language either way, so a
// nav link and a form submit button are never allowed to drift from each other.
export function Button(props: ButtonAsButton | ButtonAsLink) {
  if (props.href !== undefined) {
    const { href, variant, size, fullWidth, className, children, ...rest } = props as ButtonAsLink;
    return (
      <Link href={href} className={classes({ variant, size, fullWidth, className })} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant, size, fullWidth, className, children, type = 'button', ...rest } =
    props as ButtonAsButton;
  return (
    <button type={type} className={classes({ variant, size, fullWidth, className })} {...rest}>
      {children}
    </button>
  );
}
