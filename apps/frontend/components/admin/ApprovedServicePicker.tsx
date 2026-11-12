'use client';

import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import type { ServicePreference } from '@shared/membership-application';
import type { CategoryDto } from '@shared/category';
import { serviceLabel, servicePath } from '@/lib/applications/service-path';

const PRIORITY: Record<1 | 2 | 3, string> = { 1: '1st preference', 2: '2nd preference', 3: '3rd preference' };

/** Any active, non-custom service; the applicant's own preferences listed first. */
export function ApprovedServicePicker({
  preferences,
  categories,
  value,
  onChange,
}: {
  preferences: ServicePreference[];
  categories: CategoryDto[];
  value: string;
  onChange: (serviceId: string) => void;
}) {
  const preferred = new Set(preferences.map((p) => p.serviceId));
  const options: ComboboxOption[] = [
    ...[...preferences]
      .sort((a, b) => a.priority - b.priority)
      .map((p) => ({
        value: p.serviceId,
        label: serviceLabel(p),
        context: `${PRIORITY[p.priority]} · ${servicePath(p)}`,
      })),
    ...categories.flatMap((c) =>
      c.services
        .filter((s) => !s.isCustom && !preferred.has(s.id))
        .map((s) => ({ value: s.id, label: s.name, context: `${c.serviceLineName} › ${c.name}` }))
    ),
  ];
  return (
    <Combobox
      id="approvedServiceId"
      label="Approve for service"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Choose a service"
      searchPlaceholder="Search any service"
      emptyText="No service matches."
    />
  );
}
