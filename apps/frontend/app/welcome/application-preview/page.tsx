import { notFound } from 'next/navigation';
import { ApplicationWizard } from '@/components/apply/ApplicationWizard';

export default function ApplicationDesignPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <ApplicationWizard
      initialApplication={null}
      accountEmail=""
      categories={[]}
      referencesRequired={false}
      previewMode
    />
  );
}
