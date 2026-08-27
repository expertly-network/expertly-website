'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileHeader } from '@/components/members/ProfileHeader';
import { ProfileSidebar } from '@/components/members/ProfileSidebar';
import { ProfileTabs } from '@/components/members/ProfileTabs';
import { MobileCtaBar } from '@/components/members/MobileCtaBar';
import { SectionEditModal } from '@/components/members/edit/SectionEditModal';
import { PageContainer } from '@/components/layout/PageContainer';
import type { MemberDto, MemberEditSection, MemberProfileEditDto } from '@shared/member';

export function ProfileClient({
  member,
  edits,
  isOwnProfile,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
}) {
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<MemberEditSection | null>(null);

  function handleSubmitted() {
    // Re-fetch the Server Component so the new pending edit's badge shows
    // up immediately, same pattern as any other server-data mutation here.
    router.refresh();
  }

  return (
    <PageContainer className="py-10 pb-24 min-[1024px]:pb-10">
      <ProfileHeader member={member} />
      <div className="mt-6 flex items-start gap-6 max-[1023px]:flex-col">
        <div className="min-w-0 flex-1">
          <ProfileTabs
            member={member}
            edits={edits}
            isOwnProfile={isOwnProfile}
            onEdit={setEditingSection}
          />
        </div>
        <ProfileSidebar member={member} isOwnProfile={isOwnProfile} />
      </div>
      <MobileCtaBar member={member} />
      <SectionEditModal
        member={member}
        section={editingSection}
        onClose={() => setEditingSection(null)}
        onSubmitted={handleSubmitted}
      />
    </PageContainer>
  );
}
