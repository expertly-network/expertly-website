import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

// The 3 button treatments docs/design-system.md documents under "Color combination
// rules" — codified here so every call site gets them from one place instead of
// re-typing the class string (this consolidates what was previously duplicated,
// near-verbatim, across TopNav, EmailPasswordForm, and StepActions).
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'sm';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-bg hover:bg-ink-2',
  secondary: 'border border-line-2 bg-bg-card text-ink hover:border-ink',
  ghost: 'text-ink-2 hover:bg-bg-alt',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'min-h-[48px] px-6',
  sm: 'min-h-[44px] px-5',
};

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
