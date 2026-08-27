import { SectionBadge } from '@/components/members/SectionBadge';
import { getSectionEditBadge } from '@/lib/members/edit-badge';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

export function ContactTab({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: 'contact') => void;
}) {
  const rows: { label: string; value: string | null; href?: string }[] = [
    { label: 'Email', value: member.contactEmail, href: member.contactEmail ? `mailto:${member.contactEmail}` : undefined },
    { label: 'Phone', value: member.contactPhone, href: member.contactPhone ? `tel:${member.contactPhone}` : undefined },
    { label: 'LinkedIn', value: member.linkedinUrl, href: member.linkedinUrl ?? undefined },
    { label: 'Website', value: member.website, href: member.website ?? undefined },
  ];
  const hasAny = rows.some((r) => r.value);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-title text-ink">Contact Information</h2>
        <div className="flex items-center gap-2">
          <SectionBadge status={getSectionEditBadge('contact', edits)} />
          {isOwnProfile && (
            <button type="button" onClick={() => onEdit('contact')} className="text-xs font-medium text-accent">
              Edit
            </button>
          )}
        </div>
      </div>
      {!hasAny ? (
        <p className="mt-2 text-sm text-ink-3">No contact details listed yet.</p>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          {rows
            .filter((r) => r.value)
            .map((r) => (
              <div key={r.label} className="rounded-xl border border-line p-4">
                <dt className="text-xs text-ink-3">{r.label}</dt>
                <dd className="mt-1 truncate text-sm font-medium text-ink">
                  {r.href ? (
                    <a href={r.href} target="_blank" rel="noopener noreferrer" className="text-accent">
                      {r.value}
                    </a>
                  ) : (
                    r.value
                  )}
                </dd>
              </div>
            ))}
        </dl>
      )}
    </section>
  );
}
