// PUT directly to the signed URL — the URL itself is the auth, not a Bearer token.
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
