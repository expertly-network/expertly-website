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

const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === label)!;

describe('dashboard consultation views', () => {
  it('lists received and requested together, tagged, with the right next step', async () => {
    await act(async () =>
      root.render(<DashboardConsultations received={[request]} sent={[{ ...request, id: '2' }]} />)
    );
    expect(host.textContent).toContain('Client One');
    expect(host.textContent).toContain('Expert Two');
    expect(host.textContent).toContain('Received');
    expect(host.textContent).toContain('Requested');
    expect(host.textContent).toContain('Reply');
    const links = [...host.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/consultations?tab=mine');
  });
  it('opens on the outbox prompt when there are no consultations at all', async () => {
    await act(async () => root.render(<DashboardConsultations received={[]} sent={[]} />));
    expect(host.querySelector('input[aria-label="Search members"]')).not.toBeNull();
    await act(async () => button('Inbox').click());
    expect(host.textContent).toContain('No consultation requests yet');
  });
  it('distinguishes an unavailable inbox from an empty one', async () => {
    await act(async () => root.render(<DashboardConsultations received={null} sent={null} />));
    expect(host.textContent).toContain("couldn't");
    await act(async () => root.render(<DashboardConsultations received={null} sent={[{ ...request, id: '2' }]} />));
    expect(host.textContent).toContain('Expert Two');
    expect(host.textContent).toContain("couldn't be loaded");
  });
});
