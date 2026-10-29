import type { AnchorHTMLAttributes } from 'react';
import { externalHref } from '@/lib/members/format';

type ExternalLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> & {
  /** A user-supplied URL; scheme-less values link as https, unsafe schemes render nothing. */
  url: string | null | undefined;
};

// New-tab link to a user-supplied address. Renders nothing unless `url` is a safe http(s)
// address — a stored `javascript:` value never becomes a clickable href.
export function ExternalLink({ url, children, ...rest }: ExternalLinkProps) {
  const href = externalHref(url);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
