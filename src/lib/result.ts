/**
 * src/lib/result.ts
 *
 * Renderer-side mirror of the main-process Result type. The discriminated
 * union lets callers narrow safely: after `if (!r.ok) return;` TypeScript
 * knows `r.value` is defined.
 */

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;
