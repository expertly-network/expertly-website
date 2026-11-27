import type { Metadata } from 'next';
import { Faq } from '@/components/faq/Faq';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { FAQ_CLIENTS, FAQ_MEMBERSHIP } from '@/lib/faq';

export const metadata: Metadata = {
  title: 'Common questions — GrowXQ',
  description:
    'Answers about GrowXQ membership, who can join, what it costs, and how clients find and contact verified finance, tax and legal experts.',
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  return (
    <PageContainer className="py-10 sm:py-24">
      <Eyebrow>Questions</Eyebrow>
      <h1 className="font-brand mt-4 text-section-title text-ink">
        Common <span className="text-accent">questions</span>.
      </h1>
      <div className="mt-8 sm:mt-10">
        <Faq membership={FAQ_MEMBERSHIP} clients={FAQ_CLIENTS} />
      </div>
      <p className="mt-6 text-sm text-ink-3 sm:mt-12">
        Still curious? Email us at{' '}
        <a href="mailto:ask@growxq.com" className="text-accent underline">
          ask@growxq.com
        </a>
        . We reply within one business day.
      </p>
    </PageContainer>
  );
}
