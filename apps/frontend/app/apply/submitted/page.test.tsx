import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ user: vi.fn(), application: vi.fn(), launched: vi.fn() }));
vi.mock('@/lib/auth/session-claims', () => ({ getSessionUser: mocks.user }));
vi.mock('@/lib/api/server', () => ({ getMyApplicationServer: mocks.application }));
vi.mock('@/lib/env', () => ({ isSiteLaunched: mocks.launched }));
vi.mock('@/components/apply/SubmittedView', () => ({ SubmittedView: () => null }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
import Page from './page';

describe('application status routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.launched.mockReturnValue(false);
    mocks.user.mockResolvedValue({ role: 'client', first_name: 'Test' });
    mocks.application.mockResolvedValue(null);
  });

  it('shows approved status for a prelaunch member without an application instead of looping', async () => {
    mocks.user.mockResolvedValue({ role: 'member', first_name: 'Test' });
    const result = await Page();
    expect(result.props).toMatchObject({ status: 'approved', prelaunch: true });
    expect(mocks.application).not.toHaveBeenCalled();
  });

  it('sends clients without an application back to the form', async () => {
    await expect(Page()).rejects.toThrow('redirect:/apply');
  });

  it('sends draft clients back to the form', async () => {
    mocks.application.mockResolvedValue({ status: 'draft' });
    await expect(Page()).rejects.toThrow('redirect:/apply');
  });

  it('shows submitted clients their status', async () => {
    mocks.application.mockResolvedValue({ status: 'submitted', firstName: 'Test' });
    expect((await Page()).props.status).toBe('submitted');
  });

  it('routes admins to their console', async () => {
    mocks.user.mockResolvedValue({ role: 'admin' });
    await expect(Page()).rejects.toThrow('redirect:/admin');
  });
});
