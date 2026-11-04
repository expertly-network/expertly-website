import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/components/consultations/ConsultationCard', () => ({ ConsultationCard: () => null }));
import { MyConsultationsList } from './MyConsultationsList';

describe('empty consultation summary', () => {
  it('keeps all four zero counters and the browse action visible before the first request', () => {
    const html = renderToStaticMarkup(<MyConsultationsList initialRequests={[]} viewerId="viewer" />);
    expect(html).toContain('Consultation statistics');
    for (const label of ['Total', 'Pending', 'Completed', 'Declined'])
      expect(html).toContain(`<dt class="text-caption font-medium text-ink-3">${label}</dt>`);
    expect(html.match(/<dd[^>]*>0<\/dd>/g)).toHaveLength(4);
    expect(html).toContain('href="/members"');
  });
});
