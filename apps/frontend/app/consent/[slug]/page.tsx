import { notFound, redirect } from 'next/navigation';
import { getConsentPolicyUrlServer } from '@/lib/api/consent-policies.server';

// Pure passthrough: fetches a fresh signed URL for the slug's PDF and immediately redirects to
// it. Opened via target="_blank", so this lands in the new tab for only the instant it takes to
// redirect — the browser's native PDF viewer then takes over, displaying inline (not downloaded).
export default async function ConsentPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const policy = await getConsentPolicyUrlServer(slug);
  if (!policy) notFound();
  redirect(policy.contentUrl);
}
