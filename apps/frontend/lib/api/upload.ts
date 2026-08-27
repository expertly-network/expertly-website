// Raw PUT straight to Supabase Storage's signed URL — not apiFetch (that
// prefixes /v1 and attaches a Bearer token, neither of which applies here;
// the signed URL itself is the auth). See docs/rest-api.md's
// POST /v1/members/:id/uploads note: this endpoint never sees file bytes.
export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!res.ok) {
    throw new Error(`Upload failed (status ${res.status}). Please try again.`);
  }
}
