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
    expect(html).toContain('id="openKbManagerButton"');
    expect(html).toContain('id="kbManagerModal"');
    expect(html).toContain('id="providerSelect"');
  });
});

describe('preload bridge contract', () => {
  it('does not expose getApiKeys to the renderer', () => {
    const preload = readFileSync('electron/preload.cjs', 'utf8');
    expect(preload).not.toMatch(/getApiKeys\s*:/);
    expect(preload).not.toContain("ipcRenderer.invoke('app:get-api-keys'");
  });

  it('main process no longer registers the app:get-api-keys handler', () => {
    const main = readFileSync('electron/main.cjs', 'utf8');
    expect(main).not.toContain("'app:get-api-keys'");
  });

  it('main process registers the new ai:* and provider preference handlers', () => {
    const main = readFileSync('electron/main.cjs', 'utf8');
    for (const channel of [
      "'ai:generate-text'",
      "'ai:transcribe-audio'",
      "'ai:generate-video'",
      "'app:get-provider-preference'",
      "'app:set-provider-preference'",
    ]) {
      expect(main).toContain(channel);
    }
  });

  it('preload exposes the new bridge methods', () => {
    const preload = readFileSync('electron/preload.cjs', 'utf8');
    for (const method of [
      'generateText',
      'transcribeAudio',
      'generateVideo',
      'getProviderPreference',
      'setProviderPreference',
    ]) {
      expect(preload).toMatch(new RegExp(`${method}\\s*:`));
    }
  });

  it('renderer no longer holds raw provider keys or imports GoogleGenAI runtime', () => {
    const renderer = readFileSync('src/main.tsx', 'utf8');
    expect(renderer).not.toMatch(/runtimeApiKeys/);
    expect(renderer).not.toMatch(/requireApiKey\s*\(/);
    expect(renderer).not.toMatch(/new GoogleGenAI\(/);
  });
});
