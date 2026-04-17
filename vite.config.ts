import path from 'path';
import { defineConfig, loadEnv } from 'vite';

const loadLocalEnvFiles = () => {
  for (const fileName of ['.env.local', 'env.local']) {
    try {
      process.loadEnvFile(fileName);
    } catch (error: any) {
      // Ignore missing local env files; other parse errors should still surface.
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }
};

/**
 * Builds the Vite configuration for the current execution mode.
 *
 * @param {{mode: string}} configEnv The Vite config environment descriptor.
 * @returns {import('vite').UserConfig} The resolved Vite configuration object.
 */
const createViteConfig = ({ mode }: { mode: string }) => {
  loadLocalEnvFiles();
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 5173,
      strictPort: true,
      host: '127.0.0.1',
    },
    plugins: [],
    test: {
      environment: 'jsdom',
    },
    define: {
      'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_TEXT_MODEL': JSON.stringify(env.GEMINI_TEXT_MODEL),
      'process.env.GEMINI_TRANSCRIPTION_MODEL': JSON.stringify(env.GEMINI_TRANSCRIPTION_MODEL),
      'process.env.GEMINI_VIDEO_MODEL': JSON.stringify(env.GEMINI_VIDEO_MODEL),
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
      'process.env.OPENAI_TEXT_MODEL': JSON.stringify(env.OPENAI_TEXT_MODEL),
      'process.env.OPENAI_TRANSCRIPTION_MODEL': JSON.stringify(env.OPENAI_TRANSCRIPTION_MODEL),
      'process.env.ANTHROPIC_API_KEY': JSON.stringify(env.ANTHROPIC_API_KEY),
      'process.env.ANTHROPIC_TEXT_MODEL': JSON.stringify(env.ANTHROPIC_TEXT_MODEL),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
};

export default defineConfig(createViteConfig);
