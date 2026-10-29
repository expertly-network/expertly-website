// Safety ceiling for list endpoints that aren't paginated yet (admin queues, a member's own
// lists, resource catalogs). Without it a list grows with the table — and PostgREST silently cuts
// any response at its own max_rows (1000 by default) anyway. Lists are ordered so that the rows
// kept are the relevant ones (newest first for queues and histories).
export const MAX_LIST_ROWS = 500;
