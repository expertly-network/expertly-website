import { describe, expect, it } from 'vitest';
import { ApplicationsRepository } from './applications.repository';
import { fakeSupabaseService } from '../../test/helpers/fake-supabase';

describe('ApplicationsRepository.findServiceDetails', () => {
  it('resolves category and service line names for each service', async () => {
    const { service } = fakeSupabaseService((call) => {
      if (call.table === 'services')
        return { data: [{ id: 's1', name: 'Benchmarking', category_id: 'c1', is_custom: false, is_active: true }] };
      if (call.table === 'categories') return { data: [{ id: 'c1', name: 'Transfer Pricing', service_line_id: 'l1' }] };
      if (call.table === 'service_lines') return { data: [{ id: 'l1', name: 'Tax' }] };
      return { data: [] };
    });
    const repo = new ApplicationsRepository(service);

    const details = await repo.findServiceDetails(['s1']);

    expect(details.get('s1')).toEqual({
      name: 'Benchmarking',
      categoryId: 'c1',
      categoryName: 'Transfer Pricing',
      serviceLineId: 'l1',
      serviceLineName: 'Tax',
      isCustom: false,
      isActive: true,
    });
  });
});
