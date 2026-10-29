'use client';
import { useState } from 'react';
import type {
  AdminPerkDto,
  AdminLearningDto,
  AdminCollectionDto,
  AdminTemplateDto,
} from '@shared/resource';
import { Badge, Button, Card, Input } from '@/components/ui';
import {
  ResourceEditor,
  type ResourceEdit,
  type AdminResource,
} from './ResourceEditor';
import { ResourceDialog } from './ResourceDialog';
import { deleteResource } from '@/lib/api/resources';
export function AdminResources({
  initialPerks,
  initialVideos,
  initialCollections,
  initialTemplates,
}: {
  initialPerks: AdminPerkDto[];
  initialVideos: AdminLearningDto[];
  initialCollections: AdminCollectionDto[];
  initialTemplates: AdminTemplateDto[];
}) {
  const [perks, setPerks] = useState(initialPerks);
  const [videos, setVideos] = useState(initialVideos);
  const [collections, setCollections] = useState(initialCollections);
  const [templates, setTemplates] = useState(initialTemplates);
  const [tab, setTab] = useState<'perks' | 'learnings' | 'templates' | 'collections'>(
    'perks',
  );
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ResourceEdit | null>(null);
  const [deleting, setDeleting] = useState<{
    kind: typeof tab;
    id: string;
    title: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const rows: AdminResource[] = (
    tab === 'perks'
      ? perks
      : tab === 'learnings'
        ? videos
        : tab === 'templates'
          ? templates
          : collections
  )
    .filter((r) =>
      ('name' in r ? r.name : r.title).toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
  function edit(row: AdminResource) {
    setNotice('');
    if ('name' in row) setEditing({ kind: 'perks', record: row });
    else if ('videoUrl' in row) setEditing({ kind: 'learnings', record: row });
    else if ('filePath' in row) setEditing({ kind: 'templates', record: row });
    else setEditing({ kind: 'collections', record: row });
  }
  function create() {
    setNotice('');
    if (tab === 'perks') setEditing({ kind: tab, record: null });
    else if (tab === 'learnings') setEditing({ kind: tab, record: null });
    else if (tab === 'templates') setEditing({ kind: tab, record: null });
    else setEditing({ kind: tab, record: null });
  }
  function saved(row: AdminResource) {
    if ('name' in row)
      setPerks((prev) => [...prev.filter((p) => p.id !== row.id), row]);
    else if ('videoUrl' in row)
      setVideos((prev) => [...prev.filter((p) => p.id !== row.id), row]);
    else if ('filePath' in row)
      setTemplates((prev) => [...prev.filter((p) => p.id !== row.id), row]);
    else
      setCollections((prev) => [...prev.filter((p) => p.id !== row.id), row]);
    setEditing(null);
    setNotice('Changes saved.');
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError('');
    try {
      await deleteResource(deleting.kind, deleting.id);
      if (deleting.kind === 'perks')
        setPerks((p) => p.filter((r) => r.id !== deleting.id));
      if (deleting.kind === 'learnings')
        setVideos((p) => p.filter((r) => r.id !== deleting.id));
      if (deleting.kind === 'templates')
        setTemplates((p) => p.filter((r) => r.id !== deleting.id));
      setCollections((p) =>
        p
          .filter(
            (r) => deleting.kind !== 'collections' || r.id !== deleting.id,
          )
          .map((r) => ({
            ...r,
            itemIds:
              deleting.kind === 'collections'
                ? r.itemIds
                : r.itemIds.filter((id) => id !== deleting.id),
          })),
      );
      setDeleting(null);
      setNotice('Resource deleted.');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not delete this resource.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Resource type"
          className="flex flex-wrap gap-2"
        >
          {(['perks', 'learnings', 'templates', 'collections'] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? 'primary' : 'secondary'}
              aria-pressed={tab === t}
              onClick={() => {
                setTab(t);
                setQ('');
              }}
            >
              {t === 'perks'
                ? `Perks (${perks.length})`
                : t === 'learnings'
                  ? `Videos (${videos.length})`
                  : t === 'templates'
                    ? `Templates (${templates.length})`
                    : `Playlists, stacks & kits (${collections.length})`}
            </Button>
          ))}
        </div>
        <Button onClick={create}>
          Create{' '}
          {tab === 'perks'
            ? 'perk'
            : tab === 'learnings'
              ? 'video'
              : tab === 'templates'
                ? 'template'
                : 'collection'}{' '}
          +
        </Button>
      </div>
      <div className="mb-5 max-w-lg">
        <Input
          id="admin-resource-search"
          label="Search resources"
          type="search"
          placeholder="Search by name or title"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {notice && (
        <p role="status" className="mb-4 text-sm text-accent">
          {notice}
        </p>
      )}
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} padding="sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="break-words font-sans text-sm font-semibold">
                    {'name' in r ? r.name : r.title}
                  </h2>
                  <Badge variant={r.isActive ? 'success' : 'neutral'}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {'offerStatus' in r && (
                    <Badge>
                      {r.offerStatus === 'live' ? 'Live offer' : 'Coming soon'}
                    </Badge>
                  )}
                  {'access' in r && (
                    <Badge>
                      {r.access === 'auto'
                        ? 'Playlist access'
                        : r.access === 'open'
                          ? 'Signed-in users'
                          : 'Members only'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-ink-3">
                  {'category' in r
                    ? r.category
                    : r.kind === 'learning_playlist'
                      ? `Learning playlist · ${r.itemIds.length} videos`
                      : r.kind === 'template_kit'
                        ? `Template kit · ${r.itemIds.length} templates`
                        : `Perk stack · ${r.itemIds.length} tools`}{' '}
                  · Order {r.sortOrder}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => edit(r)}
                  aria-label={`Edit ${'name' in r ? r.name : r.title}`}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-error"
                  onClick={() => {
                    setError('');
                    setDeleting({
                      kind: tab,
                      id: r.id,
                      title: 'name' in r ? r.name : r.title,
                    });
                  }}
                  aria-label={`Delete ${'name' in r ? r.name : r.title}`}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {!rows.length && (
          <Card padding="md">
            <p className="text-sm text-ink-3">
              {q
                ? 'No resources match your search.'
                : 'No resources yet. Create the first one above.'}
            </p>
          </Card>
        )}
      </div>
      {editing && (
        <ResourceEditor
          editing={editing}
          perks={perks}
          videos={videos}
          templates={templates}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}{' '}
      {deleting && (
        <ResourceDialog
          title="Delete this resource?"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p className="text-sm text-ink-3">
            “{deleting.title}” will be permanently removed
            {deleting.kind !== 'collections'
              ? ' from the library and every playlist, stack or kit that includes it'
              : ''}
            . This cannot be undone.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-error">
              {error}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={remove}
              className="bg-error hover:bg-error/90"
            >
              {busy ? 'Deleting…' : 'Delete resource'}
            </Button>
          </div>
        </ResourceDialog>
      )}
    </div>
  );
}
