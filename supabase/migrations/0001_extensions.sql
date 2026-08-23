-- Expertly: Postgres extensions.
--
-- One of four files (0001_extensions.sql, 0002_enums.sql, 0003_functions.sql,
-- 0004_tables.sql) that together form the current schema, applied in that order. See
-- supabase/migrations/README.md for why the schema is split this way and the
-- pre-production convention that keeps it as one set of files rather than an
-- accumulating migration history.

create extension if not exists citext;
