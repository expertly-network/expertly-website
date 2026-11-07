import type { RenewalDueState } from '@shared/member';
export const RENEWAL_PERIOD_MONTHS = 12;
export const RENEWAL_REMINDER_DAYS = 30;
export function renewalDueDate(startedAt: string): Date {
  const due = new Date(startedAt);
  due.setUTCMonth(due.getUTCMonth() + RENEWAL_PERIOD_MONTHS);
  return due;
}
export function computeDueState(startedAt: string, now = new Date()): RenewalDueState {
  const due = renewalDueDate(startedAt);
  const reminder = new Date(due);
  reminder.setUTCDate(reminder.getUTCDate() - RENEWAL_REMINDER_DAYS);
  if (now >= due) return 'overdue';
  if (now >= reminder) return 'due-soon';
  return 'active';
}
