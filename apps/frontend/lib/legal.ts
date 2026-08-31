// Placeholder legal documents hosted in Supabase Storage's public `legal` bucket — not final
// copy, just something real to link to until legal review produces the actual documents. Derived
// from NEXT_PUBLIC_SUPABASE_URL rather than hardcoded so dev/prod each point at their own project.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const TERMS_OF_SERVICE_URL = `${SUPABASE_URL}/storage/v1/object/public/legal/terms-of-service.html`;
export const PRIVACY_POLICY_URL = `${SUPABASE_URL}/storage/v1/object/public/legal/privacy-policy.html`;
