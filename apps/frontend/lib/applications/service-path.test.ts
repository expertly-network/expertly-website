import { describe, expect, it } from 'vitest';
import { serviceLabel, servicePath } from './service-path';

const p = {
  serviceId: 's',
  priority: 1 as const,
  serviceName: 'Benchmarking',
  categoryId: 'c',
  categoryName: 'Transfer Pricing',
  serviceLineId: 'l',
  serviceLineName: 'Tax',
};

describe('service path', () => {
  it('joins service line and category', () => expect(servicePath(p)).toBe('Tax › Transfer Pricing'));
  it('labels with the custom label when present', () => {
    expect(serviceLabel(p)).toBe('Benchmarking');
    expect(serviceLabel({ ...p, customLabel: 'GST' })).toBe('Benchmarking (GST)');
  });
});
