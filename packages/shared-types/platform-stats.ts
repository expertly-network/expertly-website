// GET /v1/stats — the real figures behind the home page hero (public, no auth).
export interface PlatformStatsResponse {
  /** Active members (the directory's "Verified Experts"). */
  members: number;
  /** Distinct countries (case/whitespace-insensitive) among those active members. */
  jurisdictions: number;
  /** Active practice areas = active categories. */
  practiceAreas: number;
  /** Every consultation request received so far, whatever its status. */
  consultations: number;
}
