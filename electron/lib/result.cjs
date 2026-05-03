/**
 * electron/lib/result.cjs
 *
 * Discriminated-union Result helpers used at IPC and tool boundaries to
 * enforce a strict data XOR error contract: a Result is either
 * `{ ok: true, value }` or `{ ok: false, error }`, never both, never neither.
 *
 * The boundary asserts the shape so a contract violation crashes loudly in
 * dev rather than letting a partial/undefined state slip through to the
 * renderer or to a tool consumer.
 */

'use strict';

const assert = require('node:assert');

/**
 * Wraps a successful value in an Ok result.
 *
 * @template T
 * @param {T} value The success payload.
 * @returns {{ok: true, value: T}}
 */
const ok = (value) => ({ ok: true, value });

/**
 * Wraps an error payload in an Err result.
 *
 * @template E
 * @param {E} error The error payload — typically `{code, message}`.
 * @returns {{ok: false, error: E}}
 */
const err = (error) => ({ ok: false, error });

/**
 * Asserts the data XOR error contract and returns the result unchanged.
 * Crashes loudly in dev if the shape is wrong; cheap shape check in prod.
 *
 * @template T, E
 * @param {{ok: true, value: T} | {ok: false, error: E}} r
 * @returns {{ok: true, value: T} | {ok: false, error: E}}
 */
const assertResult = (r) => {
  assert(r && typeof r === 'object', 'Result must be an object');
  assert(typeof r.ok === 'boolean', 'Result.ok must be boolean');
  if (r.ok) {
    assert('value' in r && !('error' in r), 'Ok must have value, not error');
  } else {
    assert('error' in r && !('value' in r), 'Err must have error, not value');
  }
  return r;
};

module.exports = { ok, err, assertResult };
