#!/usr/bin/env node
/**
 * scripts/doctor.mjs
 *
 * Read-only health diagnostic for an installed/running Ramble On.
 * Exits 0 even when checks fail — this is a report, not a gate. Use
 * `--json` to emit machine-readable output for scripting.
 */

import { runAllChecks } from './lib/checks.mjs';

const renderTable = (results) => {
  const widthName = Math.max(...results.map((r) => r.name.length)) + 2;
  const widthLabel = Math.max(...results.map((r) => r.label.length)) + 2;
  console.log('\nRamble On — doctor\n');
  for (const r of results) {
    const marker = r.ok ? 'PASS' : 'FAIL';
    const detail = r.detail ? `  ${r.detail}` : '';
    console.log(
      `  [${marker}] ${r.name.padEnd(widthName)}${r.label.padEnd(widthLabel)}${detail}`,
    );
  }
  const failed = results.filter((r) => !r.ok);
  console.log('');
  if (failed.length === 0) {
    console.log('All diagnostics passed.');
  } else {
    console.log(
      `${failed.length} of ${results.length} check(s) need attention. ` +
        'See `detail` column for next steps.',
    );
  }
};

const main = async () => {
  const json = process.argv.includes('--json');
  const results = await runAllChecks();
  if (json) {
    console.log(
      JSON.stringify(
        {
          results,
          summary: {
            pass: results.filter((r) => r.ok).length,
            fail: results.filter((r) => !r.ok).length,
            total: results.length,
          },
        },
        null,
        2,
      ),
    );
  } else {
    renderTable(results);
  }
};

main().catch((error) => {
  console.error('[doctor] fatal:', error);
  process.exit(2);
});
