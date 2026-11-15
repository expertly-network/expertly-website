'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileHeader } from '@/components/members/ProfileHeader';
import { ProfileSidebar } from '@/components/members/ProfileSidebar';
import { ProfileTabs } from '@/components/members/ProfileTabs';
import { MobileCtaBar } from '@/components/members/MobileCtaBar';
import { SectionEditModal, type EditTarget } from '@/components/members/edit/SectionEditModal';
import { RequestConsultationModal } from '@/components/consultations/RequestConsultationModal';
import { PageContainer } from '@/components/layout/PageContainer';
import type { MemberDto } from '@shared/member';

export function ProfileClient({
  member,
  isOwnProfile,
  viewerName,
  viewerEmail,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
  viewerName?: string;
  viewerEmail?: string;
}) {
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<EditTarget | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  function handleSaved() {
    // Re-fetch the Server Component: an edit is live at once, so the new entry (and its Pending
    // Verification badge) shows straight away.
    router.refresh();
  }

  return (
    // Phones: no side gutter — the header, tabs and cards use the full screen width.
    <PageContainer className="pb-28 pt-10 max-[720px]:!px-0 max-[720px]:pt-0 min-[1024px]:pb-20">
      <ProfileHeader member={member} isOwnProfile={isOwnProfile} />
      <div className="mt-5 flex items-start gap-6 max-[1023px]:flex-col max-[720px]:mt-0 max-[720px]:gap-4">
        {/* w-full: stacked (flex-col + items-start) the column would otherwise size to the tab
            bar's natural width and overflow a 375px screen instead of letting the tabs scroll. */}
        <div className="w-full min-w-0 flex-1">
          <ProfileTabs
            member={member}
            isOwnProfile={isOwnProfile}
            onEdit={setEditingSection}
            onRequestConsultation={isOwnProfile ? undefined : () => setRequestModalOpen(true)}
          />
        </div>
        <ProfileSidebar
          member={member}
          isOwnProfile={isOwnProfile}
          onRequestConsultation={() => setRequestModalOpen(true)}
        />
      </div>
      <MobileCtaBar
        member={member}
        isOwnProfile={isOwnProfile}
        onRequestConsultation={() => setRequestModalOpen(true)}
      />
      <RequestConsultationModal
        memberId={member.id}
        memberName={member.name}
        services={member.services}
        prefillName={viewerName}
        prefillEmail={viewerEmail}
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
      />
      <SectionEditModal
        member={member}
        target={editingSection}
        onClose={() => setEditingSection(null)}
        onSaved={handleSaved}
      />
    </PageContainer>
  );
}
