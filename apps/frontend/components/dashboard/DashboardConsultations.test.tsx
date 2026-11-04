// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsultationRequestDto } from '@shared/consultation-request';
vi.mock('@/components/search/SearchBox', () => ({ SearchBox: () => <input aria-label="Search members" /> }));
import { DashboardConsultations } from './DashboardConsultations';

const request = {
  id: '1',
  requesterName: 'Client One',
  memberName: 'Expert Two',
  message: 'Advice on tax',
  status: 'pending',
  createdAt: '2026-11-01T00:00:00Z',
} as ConsultationRequestDto;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('dashboard consultation views', () => {
  it('switches from received requests to the real sent requests and correct full-page tab', async () => {
    await act(async () =>
      root.render(<DashboardConsultations received={[request]} sent={[{ ...request, id: '2' }]} />)
    );
    expect(host.textContent).toContain('Client One');
    expect(host.textContent).toContain('Reply');
    const outbox = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Outbox')!;
    await act(async () => outbox.click());
    expect(host.textContent).toContain('Expert Two');
    expect(host.textContent).not.toContain('Client One');
    expect(host.textContent).not.toContain('Reply');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/consultations?tab=mine');
    expect(host.querySelector('input[aria-label="Search members"]')).not.toBeNull();
  });
  it('distinguishes an unavailable inbox from an empty outbox', async () => {
    await act(async () => root.render(<DashboardConsultations received={null} sent={[]} />));
    expect(host.textContent).toContain("couldn't");
    const outbox = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Outbox')!;
    await act(async () => outbox.click());
    expect(host.textContent).toContain('haven’t sent');
    expect(host.textContent).not.toContain("couldn't");
  });
});
