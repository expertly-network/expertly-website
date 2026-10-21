import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { LEGAL_DOCS } from '@/lib/legal-content';

// Only the known docs exist — anything else is a real 404 at routing time.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((doc) => ({ doc }));
}

export function generateMetadata({ params }: { params: { doc: string } }): Metadata {
  const doc = LEGAL_DOCS[params.doc];
  return doc ? { title: `${doc.title} — Expertly` } : {};
}

export default function LegalPage({ params }: { params: { doc: string } }) {
  const doc = LEGAL_DOCS[params.doc];
  if (!doc) notFound();

  return (
    <PageContainer className="py-16 max-[640px]:py-10">
      <article className="mx-auto w-full max-w-[720px]">
        <Eyebrow>Legal</Eyebrow>
        <h1 className="mt-4 text-heading text-ink">{doc.title}</h1>
        {doc.draft && (
          <p className="mt-6 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Draft — this document is being finalised with legal review and will be updated here.
          </p>
        )}
        <div className="mt-8 flex flex-col gap-4 text-[15px] leading-[1.7] text-ink-2">{doc.body}</div>
      </article>
    </PageContainer>
  );
}
