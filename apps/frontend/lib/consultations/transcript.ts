import type { ConsultationRequestDto } from '@shared/consultation-request';

// Leading = + - @ (or tab/CR) would make a spreadsheet treat the cell as a formula — prefix a quote.
function csvEscape(value: string): string {
  const str = String(value);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return /["\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// CSV export of the caller's consultation requests, from either side: the member's Received tab
// (who asked) or the requester's My Requests tab (which member was asked).
export function downloadTranscript(requests: ConsultationRequestDto[], side: 'received' | 'mine'): void {
  const headers =
    side === 'received'
      ? ['Requester', 'Type', 'Firm', 'Message', 'Email', 'Phone', 'Received', 'Status']
      : ['Member', 'Firm', 'Message', 'Sent', 'Status', 'Response'];
  const rows = requests.map((r) =>
    side === 'received'
      ? [
          r.requesterName,
          r.requesterIsVerifiedMember ? 'Member' : 'Client',
          r.requesterFirmName ?? '',
          r.message,
          r.requesterContactEmail,
          r.requesterPhone,
          new Date(r.createdAt).toLocaleDateString('en-US'),
          r.status,
        ]
      : [
          r.memberName ?? '',
          r.memberFirmName ?? '',
          r.message,
          new Date(r.createdAt).toLocaleDateString('en-US'),
          r.status,
          r.responseMessage ?? '',
        ]
  );
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expertly-consultations-${side === 'received' ? 'received' : 'requested'}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
