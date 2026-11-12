import type { ServicePreference } from '@shared/membership-application';

/** "Tax › Transfer Pricing" — service names repeat across categories, so always show where one sits. */
export function servicePath(p: Pick<ServicePreference, 'serviceLineName' | 'categoryName'>): string {
  return `${p.serviceLineName} › ${p.categoryName}`;
}

export function serviceLabel(p: Pick<ServicePreference, 'serviceName' | 'customLabel'>): string {
  return p.customLabel ? `${p.serviceName} (${p.customLabel})` : p.serviceName;
}
