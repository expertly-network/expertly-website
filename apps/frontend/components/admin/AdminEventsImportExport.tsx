'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from '@/components/ui';
import { downloadEventsCsv, importEventsCsv, ImportEventsError } from '@/lib/api/events';
import type { ImportEventsResponse } from '@shared/event';

const ACTION_LABEL = { created: 'Created', updated: 'Updated', deleted: 'Deleted' } as const;

// Export is a one-click download; import opens a modal since it needs a file picker and has two
// very different outcomes to show (a success summary, or the full list of per-row validation
// errors — see ImportEventsError in lib/api/events.ts for why those are kept as a list rather
// than one run-on string).
export function AdminEventsImportExport() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function handleExport() {
    setExportError(null);
    setExporting(true);
    try {
      await downloadEventsCsv();
    } catch {
      setExportError('Could not export events. Try again.');
    } finally {
      setExporting(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col items-end gap-1">
        <Button variant="secondary-dark" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
        {exportError && <span className="text-xs text-error">{exportError}</span>}
      </div>
      <Button variant="secondary-dark" size="sm" onClick={() => setModalOpen(true)}>
        Import CSV
      </Button>
      <ImportModal open={modalOpen} onClose={closeModal} onImported={() => router.refresh()} />
    </div>
  );
}

function ImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rowErrors, setRowErrors] = useState<string[] | null>(null);
  const [result, setResult] = useState<ImportEventsResponse | null>(null);

  function reset() {
    setFile(null);
    setRowErrors(null);
    setResult(null);
    setUploading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRowErrors(null);
    setResult(null);
    setFile(e.target.files?.[0] ?? null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setRowErrors(null);
    try {
      const response = await importEventsCsv(file);
      setResult(response);
      onImported();
    } catch (err) {
      setRowErrors(err instanceof ImportEventsError ? err.rowErrors : ['Something went wrong. Try again.']);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import events from CSV" size="lg">
      {result ? (
        <ImportResult result={result} onDone={handleClose} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-input border border-line-2 bg-bg-alt px-4 py-3 text-xs text-ink-2">
            This is a <strong>full sync</strong>, not an additive import. A blank <code>id</code>{' '}
            column creates a new event; a filled <code>id</code> matching an existing event
            replaces it; any existing event whose <code>id</code> isn&apos;t in the file gets{' '}
            <strong>deleted</strong>. Nothing is written if any row fails validation — start from{' '}
            <strong>Export CSV</strong> and edit that file to be safe.
            <br />
            <br />
            <code>eventFormat</code> must be one of <code>in_person</code>, <code>virtual</code>,{' '}
            <code>hybrid</code> (or blank). <code>eventType</code> is free text, not a fixed
            list — reuse an existing category (e.g. &quot;Tax&quot;, &quot;M&amp;A&quot;,
            &quot;Legal&quot;) for consistency rather than inventing a new one. <code>status</code>{' '}
            must be <code>draft</code> or <code>published</code> (blank defaults to draft).
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="self-start rounded-input border border-line-2 px-4 py-2 text-sm font-medium text-ink hover:border-ink disabled:opacity-50"
            >
              {file ? 'Choose a different file' : 'Choose CSV file'}
            </button>
            <span className="text-xs text-ink-3">{file ? file.name : 'No file selected — .csv only.'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>

          {rowErrors && (
            <div className="rounded-input bg-[color-mix(in_oklab,var(--error)_8%,transparent)] px-4 py-3">
              <p className="text-sm font-medium text-error">
                Nothing was imported — {rowErrors.length} issue{rowErrors.length === 1 ? '' : 's'} to fix:
              </p>
              <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-error">
                {rowErrors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ImportResult({ result, onDone }: { result: ImportEventsResponse; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-6 rounded-input bg-[color-mix(in_oklab,var(--ok)_8%,transparent)] px-4 py-3 text-sm text-ok">
        <span>
          <strong>{result.createdCount}</strong> created
        </span>
        <span>
          <strong>{result.updatedCount}</strong> updated
        </span>
        <span>
          <strong>{result.deletedCount}</strong> deleted
        </span>
      </div>
      {result.results.length > 0 && (
        <ul className="max-h-72 overflow-y-auto rounded-input border border-line-2">
          {result.results.map((row, i) => (
            <li
              key={`${row.id}-${i}`}
              className="flex items-center justify-between gap-3 border-b border-line-2 px-4 py-2 text-sm last:border-b-0"
            >
              <span className="truncate text-ink">{row.title}</span>
              <span className="shrink-0 text-xs text-ink-3">{ACTION_LABEL[row.action]}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
