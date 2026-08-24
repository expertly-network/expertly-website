import { Badge } from '@/components/ui/Badge';

/**
 * Subtle "came from LinkedIn" indicator for a field label — used via Input/Textarea's
 * `labelRight` slot. Renders nothing once the field has been edited (see
 * ApplicationWizard.update, which drops a field from `importedFields` on any change to it), so
 * this never lies about provenance.
 */
export function ImportedTag() {
  return <Badge variant="brand">Imported</Badge>;
}
