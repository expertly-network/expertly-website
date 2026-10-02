'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileHeader } from '@/components/members/ProfileHeader';
import { ProfileSidebar } from '@/components/members/ProfileSidebar';
import { ProfileTabs } from '@/components/members/ProfileTabs';
import { MobileCtaBar } from '@/components/members/MobileCtaBar';
import { SectionEditModal } from '@/components/members/edit/SectionEditModal';
import { RequestConsultationModal } from '@/components/consultations/RequestConsultationModal';
import { PageContainer } from '@/components/layout/PageContainer';
import type { MemberDto, MemberEditSection, MemberProfileEditDto } from '@shared/member';

export function ProfileClient({
  member,
  edits,
  isOwnProfile,
  viewerName,
  viewerEmail,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  viewerName?: string;
  viewerEmail?: string;
}) {
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<MemberEditSection | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  function handleSubmitted() {
    // Re-fetch the Server Component so the new pending edit's badge shows
    // up immediately, same pattern as any other server-data mutation here.
    router.refresh();
  }

  return (
    <PageContainer className="pb-28 pt-10 max-[720px]:pt-5 min-[1024px]:pb-20">
      <ProfileHeader member={member} />
      <div className="mt-5 flex items-start gap-6 max-[1023px]:flex-col">
        <div className="min-w-0 flex-1">
          <ProfileTabs
            member={member}
            edits={edits}
            isOwnProfile={isOwnProfile}
            onEdit={setEditingSection}
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
        section={editingSection}
        onClose={() => setEditingSection(null)}
        onSubmitted={handleSubmitted}
      />
    </PageContainer>
  );
}
