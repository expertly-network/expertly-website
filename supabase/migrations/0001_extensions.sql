-- Expertly: Postgres extensions.
--
-- One of four files (0001_extensions.sql, 0002_enums.sql, 0003_functions.sql,
-- 0004_tables.sql) that together form the current schema, applied in that order. See
-- supabase/migrations/README.md for why the schema is split this way and the
-- pre-production convention that keeps it as one set of files rather than an
-- accumulating migration history.

create extension if not exists citext;

-- AI search (see 0004_tables.sql "AI search"): halfvec embeddings + trigram name matching.
-- On Supabase `extensions` is the standard extension schema and `vector` lives in `public`;
-- the search functions set search_path = public, extensions so both resolve.
-- `vector` stays in `public` on purpose: search_documents.embedding's halfvec(768) type and the
-- HNSW opclass resolve through it, and moving it (`alter extension vector set schema`) would
-- re-point every dependent column/index/function for no security gain — nothing is granted on it
-- to anon/authenticated (see 0004's least-privilege block).
create extension if not exists vector;
create extension if not exists pg_trgm with schema extensions;
