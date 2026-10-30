'use client';
import { useState, type FormEvent } from 'react';
import type {
  AdminPerkDto,
  AdminLearningDto,
  AdminCollectionDto,
  CreatePerkRequest,
  CreateLearningRequest,
  CreateCollectionRequest,
  ResourceAudience,
  PerkCategory,
  LearningCategory,
  AdminTemplateDto,
  CreateTemplateRequest,
  TemplateCategory,
  TemplateUploadDto,
} from '@shared/resource';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { ResourceDialog } from './ResourceDialog';
import {
  createPerk,
  updatePerk,
  createLearning,
  updateLearning,
  createCollection,
  updateCollection,
  createTemplate,
  updateTemplate,
  uploadTemplateFile,
} from '@/lib/api/resources';
import { perkCategories, learningCategories, templateCategories, audiences } from './resource-options';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
export type ResourceEdit =
  | { kind: 'perks'; record: AdminPerkDto | null }
  | { kind: 'learnings'; record: AdminLearningDto | null }
  | { kind: 'collections'; record: AdminCollectionDto | null }
  | { kind: 'templates'; record: AdminTemplateDto | null };
export type AdminResource = AdminPerkDto | AdminLearningDto | AdminCollectionDto | AdminTemplateDto;
const FILE_TYPE_LABEL = { docx: 'Word', xlsx: 'Excel', pptx: 'PowerPoint', pdf: 'PDF' } as const;
export function ResourceEditor({
  editing,
  perks,
  videos,
  templates,
  onClose,
  onSaved,
}: {
  editing: ResourceEdit;
  perks: AdminPerkDto[];
  videos: AdminLearningDto[];
  templates: AdminTemplateDto[];
  onClose: () => void;
  onSaved: (record: AdminResource) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const collection = editing.kind === 'collections' ? editing.record : null;
  const [collectionKind, setCollectionKind] = useState<'learning_playlist' | 'perk_stack' | 'template_kit'>(
    collection?.kind || 'learning_playlist'
  );
  // Template file: an existing record's file, replaced by a fresh upload if the admin picks one.
  const template = editing.kind === 'templates' ? editing.record : null;
  const [upload, setUpload] = useState<TemplateUploadDto | null>(null);
  const [uploading, setUploading] = useState(false);
  const file = upload ?? template;
  const [ids, setIds] = useState<string[]>(collection?.itemIds || []);
  const [addId, setAddId] = useState('');
  const options =
    collectionKind === 'learning_playlist'
      ? videos.map((v) => ({ id: v.id, title: v.title, active: v.isActive }))
      : collectionKind === 'template_kit'
        ? templates.map((t) => ({ id: t.id, title: t.title, active: t.isActive }))
        : perks.map((p) => ({ id: p.id, title: p.name, active: p.isActive }));
  async function pickFile(picked: File | undefined) {
    if (!picked) return;
    setUploading(true);
    setError('');
    try {
      setUpload(await uploadTemplateFile(picked));
      setDirty(true);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not upload this file.'));
    } finally {
      setUploading(false);
    }
  }
  const text = (data: FormData, key: string) => String(data.get(key) || '').trim();
  const nullable = (data: FormData, key: string) => text(data, key) || null;
  function close() {
    if (!saving && (!dirty || window.confirm('Discard your unsaved changes?'))) onClose();
  }
  function move(index: number, direction: number) {
    setDirty(true);
    setIds((prev) => {
      const next = [...prev];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing.kind === 'templates' && !file) {
      setError('Upload the template file first.');
      return;
    }
    setSaving(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const flags = {
      isActive: data.get('isActive') === 'on',
      sortOrder: Number(data.get('sortOrder') || 0),
    };
    try {
      let saved: AdminResource;
      if (editing.kind === 'perks') {
        const body: CreatePerkRequest = {
          ...flags,
          name: text(data, 'name'),
          category: text(data, 'category') as PerkCategory,
          tagline: text(data, 'tagline'),
          description: text(data, 'description'),
          products: text(data, 'products')
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
          websiteUrl: text(data, 'websiteUrl'),
          logoUrl: nullable(data, 'logoUrl'),
          coverImageUrl: nullable(data, 'coverImageUrl'),
          offerStatus: text(data, 'offerStatus') as 'coming_soon' | 'live',
          userOffer: nullable(data, 'userOffer'),
          userCouponCode: nullable(data, 'userCouponCode'),
          userOfferUrl: nullable(data, 'userOfferUrl'),
          memberOffer: nullable(data, 'memberOffer'),
          memberCouponCode: nullable(data, 'memberCouponCode'),
          memberOfferUrl: nullable(data, 'memberOfferUrl'),
          offerTerms: nullable(data, 'offerTerms'),
          offerExpiresAt: nullable(data, 'offerExpiresAt'),
          isFeatured: data.get('isFeatured') === 'on',
        };
        saved = editing.record ? await updatePerk(editing.record.id, body) : await createPerk(body);
      } else if (editing.kind === 'learnings') {
        const body: CreateLearningRequest = {
          ...flags,
          title: text(data, 'title'),
          summary: text(data, 'summary'),
          videoProvider: text(data, 'videoProvider') as 'youtube' | 'file',
          videoUrl: text(data, 'videoUrl'),
          thumbnailUrl: nullable(data, 'thumbnailUrl'),
          channel: nullable(data, 'channel'),
          durationMinutes: Number(data.get('durationMinutes')),
          category: text(data, 'category') as LearningCategory,
          level: text(data, 'level') as 'beginner' | 'intermediate' | 'advanced',
          audiences: data.getAll('audiences') as ResourceAudience[],
          access: text(data, 'access') as 'auto' | 'open' | 'members',
          isFeatured: data.get('isFeatured') === 'on',
        };
        saved = editing.record ? await updateLearning(editing.record.id, body) : await createLearning(body);
      } else if (editing.kind === 'templates') {
        if (!file) return; // checked before saving began
        const body: CreateTemplateRequest = {
          ...flags,
          title: text(data, 'title'),
          category: text(data, 'category') as TemplateCategory,
          description: text(data, 'description'),
          highlights: text(data, 'highlights')
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
          audiences: data.getAll('audiences') as ResourceAudience[],
          isFeatured: data.get('isFeatured') === 'on',
          previewImageUrl: nullable(data, 'previewImageUrl'),
          filePath: file.filePath,
          fileName: file.fileName,
          fileSizeBytes: file.fileSizeBytes,
          fileType: file.fileType,
        };
        if (editing.record) {
          // Only send the file fields when a new file was uploaded.
          const { filePath, fileName, fileSizeBytes, fileType, ...meta } = body;
          saved = await updateTemplate(
            editing.record.id,
            upload ? { ...meta, filePath, fileName, fileSizeBytes, fileType } : meta
          );
        } else saved = await createTemplate(body);
      } else {
        const body: CreateCollectionRequest = {
          ...flags,
          kind: collectionKind,
          title: text(data, 'title'),
          description: text(data, 'description'),
          audiences: data.getAll('audiences') as ResourceAudience[],
          coverImageUrl: nullable(data, 'coverImageUrl'),
          itemIds: ids,
        };
        saved = editing.record ? await updateCollection(editing.record.id, body) : await createCollection(body);
      }
      onSaved(saved);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not save. Try again.'));
    } finally {
      setSaving(false);
    }
  }
  const toggle = (name: string, label: string, checked: boolean) => (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input name={name} type="checkbox" defaultChecked={checked} className="h-4 w-4 accent-accent" />
      {label}
    </label>
  );
  const audienceFields = (current: ResourceAudience[] = []) => (
    <fieldset>
      <legend className="mb-1 text-xs font-medium">Professions (leave empty for everyone)</legend>
      <div className="flex flex-wrap gap-4">
        {audiences.map((a) => (
          <label key={a.value} className="flex min-h-11 items-center gap-2 text-sm">
            <input
              name="audiences"
              type="checkbox"
              value={a.value}
              defaultChecked={current.includes(a.value)}
              className="h-4 w-4 accent-accent"
            />
            {a.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <ResourceDialog
      title={`${editing.record ? 'Edit' : 'Create'} ${editing.kind === 'perks' ? 'perk' : editing.kind === 'learnings' ? 'video' : editing.kind === 'templates' ? 'template' : 'collection'}`}
      onClose={close}
    >
      <form onSubmit={submit} onChange={() => setDirty(true)} className="space-y-5">
        <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
          {editing.kind === 'perks' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="name" label="Product name" required maxLength={200} defaultValue={editing.record?.name} />
                <Select name="category" label="Category" defaultValue={editing.record?.category || perkCategories[0]}>
                  {perkCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <Input name="tagline" label="Short description" defaultValue={editing.record?.tagline} />
              <Textarea
                name="description"
                label="About this product"
                rows={3}
                defaultValue={editing.record?.description}
              />
              <Textarea
                name="products"
                label="Products (one per line)"
                rows={3}
                defaultValue={editing.record?.products.join('\n')}
              />
              <Input
                name="websiteUrl"
                label="Product website (HTTPS)"
                type="url"
                required
                defaultValue={editing.record?.websiteUrl}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  name="logoUrl"
                  label="Logo URL or resource-assets path"
                  defaultValue={editing.record?.logoUrl || ''}
                />
                <Input
                  name="coverImageUrl"
                  label="Cover URL or resource-assets path"
                  defaultValue={editing.record?.coverImageUrl || ''}
                />
              </div>
              <Select
                name="offerStatus"
                label="Offer status"
                defaultValue={editing.record?.offerStatus || 'coming_soon'}
              >
                <option value="coming_soon">Coming soon (offers stay hidden)</option>
                <option value="live">Live</option>
              </Select>
              <p className="text-xs text-ink-3">
                A live offer needs text and a code or HTTPS redemption link for at least one tier. To remove a tier,
                clear all three fields.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <fieldset className="space-y-3 rounded-xl border border-line p-4">
                  <legend className="px-1 text-sm font-semibold">Client offer</legend>
                  <Input name="userOffer" label="Offer text" defaultValue={editing.record?.userOffer || ''} />
                  <Input
                    name="userCouponCode"
                    label="Coupon code"
                    defaultValue={editing.record?.userCouponCode || ''}
                  />
                  <Input
                    name="userOfferUrl"
                    label="Redemption URL (HTTPS)"
                    type="url"
                    defaultValue={editing.record?.userOfferUrl || ''}
                  />
                </fieldset>
                <fieldset className="space-y-3 rounded-xl border border-line p-4">
                  <legend className="px-1 text-sm font-semibold">Member offer</legend>
                  <Input name="memberOffer" label="Offer text" defaultValue={editing.record?.memberOffer || ''} />
                  <Input
                    name="memberCouponCode"
                    label="Coupon code"
                    defaultValue={editing.record?.memberCouponCode || ''}
                  />
                  <Input
                    name="memberOfferUrl"
                    label="Redemption URL (HTTPS)"
                    type="url"
                    defaultValue={editing.record?.memberOfferUrl || ''}
                  />
                </fieldset>
              </div>
              <Textarea
                name="offerTerms"
                label="Offer terms"
                rows={3}
                defaultValue={editing.record?.offerTerms || ''}
              />
              <Input
                name="offerExpiresAt"
                label="Expiry date (valid through this UTC date)"
                type="date"
                defaultValue={editing.record?.offerExpiresAt || ''}
              />
              {toggle('isFeatured', 'Featured product', editing.record?.isFeatured || false)}
            </>
          )}
          {editing.kind === 'learnings' && (
            <>
              <Input name="title" label="Video title" required maxLength={200} defaultValue={editing.record?.title} />
              <Textarea name="summary" label="Why watch this" rows={3} defaultValue={editing.record?.summary} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select name="videoProvider" label="Provider" defaultValue={editing.record?.videoProvider || 'youtube'}>
                  <option value="youtube">YouTube</option>
                  <option value="file">Hosted video file</option>
                </Select>
                <Input
                  name="durationMinutes"
                  label="Duration (minutes)"
                  type="number"
                  min={1}
                  max={14400}
                  required
                  defaultValue={editing.record?.durationMinutes || 10}
                />
              </div>
              <Input
                name="videoUrl"
                label="Video URL (HTTPS)"
                type="url"
                required
                defaultValue={editing.record?.videoUrl}
              />
              <Input
                name="thumbnailUrl"
                label="Own-copy thumbnail path or resource-assets URL"
                defaultValue={editing.record?.thumbnailUrl || ''}
              />
              <p className="text-xs text-ink-3">
                Use an image in resource-assets, not a YouTube thumbnail URL, to keep locked video links private.
              </p>
              <Input name="channel" label="Creator / channel" defaultValue={editing.record?.channel || ''} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select name="category" label="Topic" defaultValue={editing.record?.category || learningCategories[0]}>
                  {learningCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <Select name="level" label="Level" defaultValue={editing.record?.level || 'beginner'}>
                  {['beginner', 'intermediate', 'advanced'].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </div>
              {audienceFields(editing.record?.audiences)}
              <Select name="access" label="Who can watch?" defaultValue={editing.record?.access || 'auto'}>
                <option value="auto">Automatic: first in an active playlist is open to clients</option>
                <option value="open">All signed-in users</option>
                <option value="members">Members only</option>
              </Select>
              {toggle('isFeatured', 'Featured video', editing.record?.isFeatured || false)}
            </>
          )}
          {editing.kind === 'templates' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="title" label="Template title" required maxLength={200} defaultValue={template?.title} />
                <Select name="category" label="Category" defaultValue={template?.category || templateCategories[0]}>
                  {templateCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <Textarea name="description" label="What it helps with" rows={3} defaultValue={template?.description} />
              <Textarea
                name="highlights"
                label="What's inside (one point per line)"
                rows={3}
                defaultValue={template?.highlights.join('\n')}
              />
              <fieldset className="rounded-xl border border-line p-4">
                <legend className="px-1 text-sm font-semibold">File</legend>
                {file ? (
                  <p className="mb-3 text-sm">
                    {file.fileName}{' '}
                    <span className="text-ink-3">
                      · {FILE_TYPE_LABEL[file.fileType]} · {Math.max(1, Math.round(file.fileSizeBytes / 1024))} KB
                      {upload ? ' · new upload, saved on Save changes' : ''}
                    </span>
                  </p>
                ) : (
                  <p className="mb-3 text-sm text-ink-3">No file yet.</p>
                )}
                <label className="block text-xs font-medium">
                  {file ? 'Replace file' : 'Upload file'} (Word, Excel, PowerPoint or PDF, up to 15MB)
                  <input
                    type="file"
                    accept=".docx,.xlsx,.pptx,.pdf"
                    disabled={uploading}
                    onChange={(e) => pickFile(e.target.files?.[0])}
                    className="mt-2 block w-full text-sm file:mr-3 file:rounded-input file:border file:border-line-2 file:bg-bg-card file:px-4 file:py-2 file:text-sm"
                  />
                </label>
                {uploading && (
                  <p role="status" className="mt-2 text-xs text-ink-3">
                    Uploading and checking the file…
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-3">
                  Templates are members-only. The file is stored privately and only members get a short-lived download
                  link.
                </p>
              </fieldset>
              <Input
                name="previewImageUrl"
                label="Preview image (resource-assets path like templates/previews/x.jpg, or HTTPS URL)"
                defaultValue={template?.previewImageUrl || ''}
              />
              <p className="-mt-3 text-xs text-ink-3">
                Shown publicly as the card preview (first page/sheet/slide). Leave empty for a designed cover.
              </p>
              {audienceFields(template?.audiences)}
              {toggle('isFeatured', 'Featured template', template?.isFeatured || false)}
            </>
          )}
          {editing.kind === 'collections' && (
            <>
              <Input name="title" label="Collection title" required maxLength={200} defaultValue={collection?.title} />
              <Textarea name="description" label="Description" rows={3} defaultValue={collection?.description} />
              <Select
                id="collection-kind"
                label="Collection type"
                value={collectionKind}
                disabled={!!collection}
                onChange={(e) => {
                  setCollectionKind(e.target.value as typeof collectionKind);
                  setIds([]);
                  setAddId('');
                }}
              >
                <option value="learning_playlist">Learning playlist</option>
                <option value="perk_stack">Perk starter stack</option>
                <option value="template_kit">Template kit</option>
              </Select>
              {audienceFields(collection?.audiences)}
              <Input
                name="coverImageUrl"
                label="Cover URL or resource-assets path"
                defaultValue={collection?.coverImageUrl || ''}
              />
              <fieldset>
                <legend className="mb-3 text-sm font-semibold">Items in display order</legend>
                <p className="mb-3 text-xs text-ink-3">
                  The first video in an active playlist is available to clients unless its access is Members only.
                </p>
                <ol className="space-y-2">
                  {ids.map((id, i) => (
                    <li key={id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
                      <span className="text-xs text-ink-3">{i + 1}.</span>
                      <span className="min-w-0 flex-1 text-sm">
                        {options.find((o) => o.id === id)?.title || 'Unavailable item'}
                      </span>
                      <div className="flex">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="!px-3"
                          aria-label={`Move item ${i + 1} up`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="!px-3"
                          aria-label={`Move item ${i + 1} down`}
                          disabled={i === ids.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="!px-3 text-error"
                          aria-label={`Remove item ${i + 1}`}
                          onClick={() => {
                            setIds((prev) => prev.filter((x) => x !== id));
                            setDirty(true);
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
                {!ids.length && <p className="py-3 text-sm text-ink-3">No items yet.</p>}
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <Select
                      id="collection-add"
                      label="Add an item"
                      value={addId}
                      onChange={(e) => setAddId(e.target.value)}
                    >
                      <option value="">
                        Choose a{' '}
                        {collectionKind === 'learning_playlist'
                          ? 'video'
                          : collectionKind === 'template_kit'
                            ? 'template'
                            : 'perk'}
                      </option>
                      {options
                        .filter((o) => !ids.includes(o.id))
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.title}
                            {o.active ? '' : ' (inactive)'}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={!addId || ids.length >= 100}
                    onClick={() => {
                      setIds((prev) => [...prev, addId]);
                      setAddId('');
                      setDirty(true);
                    }}
                  >
                    Add item
                  </Button>
                </div>
              </fieldset>
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="sortOrder"
              label="Display order (lower first)"
              type="number"
              min={0}
              step={1}
              defaultValue={editing.record?.sortOrder || 0}
            />
            {toggle('isActive', 'Active (visible on the website)', editing.record?.isActive ?? true)}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || uploading}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </ResourceDialog>
  );
}
