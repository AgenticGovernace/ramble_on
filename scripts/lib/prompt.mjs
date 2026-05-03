/**
 * scripts/lib/prompt.mjs
 *
 * Minimal interactive prompt helpers built on `node:readline/promises`.
 * No third-party deps. Supports `--yes` non-interactive mode via the
 * `assumeYes` flag carried through call sites.
 */

import { createInterface, emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';

const ttyOk = () => stdin.isTTY && stdout.isTTY;

const closeReadline = (rl) => {
  try {
    rl.close();
  } catch {
    // ignore
  }
};

/**
 * Yes/no prompt. Returns the default when stdin is not a TTY.
 */
export const confirm = async (question, { defaultValue = false, assumeYes = false } = {}) => {
  if (assumeYes) return true;
  if (!ttyOk()) return defaultValue;

  const hint = defaultValue ? '[Y/n]' : '[y/N]';
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(`${question} ${hint} `)).trim().toLowerCase();
    if (!answer) return defaultValue;
    return answer === 'y' || answer === 'yes';
  } finally {
    closeReadline(rl);
  }
};

/**
 * Free-text input. `mask: true` swaps echoed characters for `*` (API keys).
 */
export const input = async (question, { defaultValue = '', mask = false, assumeYes = false } = {}) => {
  if (assumeYes) return defaultValue;
  if (!ttyOk()) return defaultValue;

  if (!mask) {
    const { createInterface } = await import('node:readline/promises');
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      const hint = defaultValue ? ` [${defaultValue}]` : '';
      const answer = (await rl.question(`${question}${hint}: `)).trim();
      return answer || defaultValue;
    } finally {
      closeReadline(rl);
    }
  }

  // Masked input — manage stdin keypress events directly.
  return new Promise((resolvePromise) => {
    stdout.write(`${question}: `);
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    emitKeypressEvents(stdin, rl);
    if (stdin.setRawMode) stdin.setRawMode(true);

    const buffer = [];

    const cleanup = () => {
      if (stdin.setRawMode) stdin.setRawMode(false);
      stdin.removeListener('keypress', onKeypress);
      closeReadline(rl);
      stdout.write('\n');
    };

    const onKeypress = (str, key) => {
      if (!key) return;
      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(130);
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolvePromise(buffer.join('') || defaultValue);
        return;
      }
      if (key.name === 'backspace') {
        if (buffer.length) {
          buffer.pop();
          stdout.write('\b \b');
        }
        return;
      }
      if (str && str.length === 1 && str.charCodeAt(0) >= 32) {
        buffer.push(str);
        stdout.write('*');
      }
    };

    stdin.on('keypress', onKeypress);
  });
};

/**
 * Single-choice select via numeric index. Returns the chosen option's value.
 */
export const select = async (question, options, { defaultIndex = 0, assumeYes = false } = {}) => {
  if (assumeYes || !ttyOk()) return options[defaultIndex]?.value;

  stdout.write(`${question}\n`);
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? '*' : ' ';
    stdout.write(`  ${marker} ${i + 1}) ${opt.label}\n`);
  });
  const answer = await input(`Choose 1-${options.length}`, {
    defaultValue: String(defaultIndex + 1),
  });
  const idx = Number.parseInt(answer, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= options.length) {
    return options[defaultIndex]?.value;
  }
  return options[idx]?.value;
};

/**
 * Demands the user type an exact phrase (case-sensitive). Used for hard
 * confirmations like wiping local KB without a Notion backup.
 */
export const requireTyped = async (question, expected) => {
  if (!ttyOk()) {
    throw new Error(
      `Refusing to proceed without typed confirmation "${expected}" — stdin is not a TTY.`,
    );
  }
  const answer = await input(`${question} (type "${expected}" to confirm)`);
  return answer === expected;
};
