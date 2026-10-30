import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseService } from '../../src/auth/supabase.service';

/** One PostgREST query as built through the fluent supabase-js API. */
export interface QueryCall {
  table: string;
  /** Every builder method called after `from(table)`, in order, with its arguments. */
  steps: { method: string; args: unknown[] }[];
}

export interface QueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

export type QueryResolver = (call: QueryCall) => QueryResult | Promise<QueryResult>;

/**
 * A stand-in for the service-role client: `db.from(table)` returns a chainable builder that
 * records each step and, when awaited, resolves through `resolver`. No network.
 */
export function fakeDb(resolver: QueryResolver): { db: SupabaseClient; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const from = (table: string): unknown => {
    const call: QueryCall = { table, steps: [] };
    calls.push(call);
    const builder: Record<string | symbol, unknown> = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) =>
              Promise.resolve()
                .then(() => resolver(call))
                .then((r) => ({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }))
                .then(onFulfilled, onRejected);
          }
          return (...args: unknown[]) => {
            call.steps.push({ method: String(prop), args });
            return builder;
          };
        },
      }
    );
    return builder;
  };
  return { db: { from } as unknown as SupabaseClient, calls };
}

export function fakeSupabaseService(resolver: QueryResolver): { service: SupabaseService; calls: QueryCall[] } {
  const { db, calls } = fakeDb(resolver);
  return { service: { db } as unknown as SupabaseService, calls };
}

/** The arguments of the first `method` step in a call, e.g. argsOf(call, 'eq'). */
export function argsOf(call: QueryCall, method: string): unknown[] | undefined {
  return call.steps.find((s) => s.method === method)?.args;
}
