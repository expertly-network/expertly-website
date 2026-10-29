// Safety ceiling for list endpoints that aren't paginated yet and grow with user activity (admin
// queues, a user's own lists, published events). Admin-curated catalogs (resources, the admin
// events list behind CSV export/import) are deliberately uncapped — they grow only with admin work
// and their callers need every row. Without it a list grows with the table — and PostgREST silently cuts
// any response at its own max_rows (1000 by default) anyway. Lists are ordered so that the rows
// kept are the relevant ones (newest first for queues and histories).
export const MAX_LIST_ROWS = 500;
