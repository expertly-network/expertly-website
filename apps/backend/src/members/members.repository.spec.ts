import { describe, expect, it } from 'vitest';
import { fakeSupabaseService } from '../../test/helpers/fake-supabase';
import { MembersRepository } from './members.repository';

describe('MembersRepository.findInterviewExtras', () => {
  it('throws a coded error when the interview read fails', async () => {
    const { service } = fakeSupabaseService((call) =>
      call.table === 'member_interviews' ? { error: { message: 'boom' } } : { data: [] }
    );
    await expect(new MembersRepository(service).findInterviewExtras('m1')).rejects.toMatchObject({
      response: { code: 'INTERVIEW_DB_ERROR' },
    });
  });
  it('throws a coded error when the sub-tags read fails', async () => {
    const { service } = fakeSupabaseService((call) =>
      call.table === 'member_service_subtags' ? { error: { message: 'boom' } } : { data: null }
    );
    await expect(new MembersRepository(service).findInterviewExtras('m1')).rejects.toMatchObject({
      response: { code: 'INTERVIEW_DB_ERROR' },
    });
  });
});
