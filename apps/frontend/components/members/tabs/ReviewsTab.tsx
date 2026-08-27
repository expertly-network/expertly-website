import { Badge } from '@/components/ui';
import { SectionBadge } from '@/components/members/SectionBadge';
import { getSectionEditBadge } from '@/lib/members/edit-badge';
import type { MemberDto, MemberProfileEditDto } from '@shared/member';

export function ReviewsTab({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: 'testimonials' | 'awards') => void;
}) {
  const isEmpty = member.testimonials.length === 0 && member.awards.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-ink-3">No testimonials or awards yet.</p>
        {isOwnProfile && (
          <button type="button" onClick={() => onEdit('testimonials')} className="text-sm font-medium text-accent">
            Add a testimonial
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Client Testimonials</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('testimonials', edits)} />
            {isOwnProfile && (
              <button type="button" onClick={() => onEdit('testimonials')} className="text-xs font-medium text-accent">
                Edit
              </button>
            )}
          </div>
        </div>
        {member.testimonials.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No testimonials yet.</p>
        ) : (
          <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
            {member.testimonials.map((t) => (
              <div key={t.id} className="w-80 shrink-0 rounded-xl border border-line p-4">
                {t.isVerified && <Badge variant="brand">Verified</Badge>}
                <p className="mt-2 text-sm italic text-ink-2">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-2 text-xs font-medium text-ink">{t.clientName}</p>
                <p className="text-xs text-ink-3">
                  {[t.clientTitle, t.clientCompany].filter(Boolean).join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-title text-ink">Awards &amp; Recognition</h2>
          <div className="flex items-center gap-2">
            <SectionBadge status={getSectionEditBadge('awards', edits)} />
            {isOwnProfile && (
              <button type="button" onClick={() => onEdit('awards')} className="text-xs font-medium text-accent">
                Edit
              </button>
            )}
          </div>
        </div>
        {member.awards.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No awards yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            {member.awards.map((award) => (
              <div key={award.id} className="rounded-xl border border-line p-4">
                <div className="font-medium text-ink">{award.title}</div>
                <div className="text-sm text-ink-3">
                  {[award.issuingBody, award.year].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
