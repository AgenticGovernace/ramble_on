import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('static entry points', () => {
  it('references the expected entry files', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('/src/main.tsx');
    expect(html).toContain('/src/index.css');
  });

  it('includes key app element ids', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('id="recordButton"');
    expect(html).toContain('id="rawTranscription"');
    expect(html).toContain('id="polishedNote"');
  });
});
