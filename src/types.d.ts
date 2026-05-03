import type { Result } from './lib/result';

export {};

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    rambleOnDB?: {
      saveRecording: (payload: {
        recordingId: string;
        noteId: string | null;
        appendMode: boolean;
        createdAt?: number;
      }) => Promise<void>;
      saveRawEntry: (payload: {
        recordingId: string;
        noteId: string | null;
        content: string;
        createdAt?: number;
      }) => Promise<void>;
      savePolishedEntry: (payload: {
        recordingId: string;
        noteId: string | null;
        content: string;
        createdAt?: number;
      }) => Promise<void>;
      getKnowledgeBase: () => Promise<{
        rootPath: string;
        tree: Array<{
          type: 'folder' | 'file';
          name: string;
          children?: any[];
          content?: string;
          path?: string;
        }>;
      }>;
      writeKnowledgeBaseFile: (payload: {
        relativePath: string;
        content: string;
      }) => Promise<{ success: boolean }>;
      createKnowledgeBaseFolder: (payload: {
        parentPath?: string;
        name: string;
      }) => Promise<{ success: boolean; path: string }>;
      createKnowledgeBaseFile: (payload: {
        parentPath?: string;
        name: string;
        content?: string;
      }) => Promise<{ success: boolean; path: string }>;
      deleteKnowledgeBasePath: (payload: {
        relativePath: string;
      }) => Promise<{ success: boolean }>;
      renameKnowledgeBasePath: (payload: {
        relativePath: string;
        newName: string;
      }) => Promise<{ success: boolean; path: string }>;
      onKnowledgeBaseUpdated: (callback: () => void) => void;
      getProviderPreference: () => Promise<
        'gemini' | 'openai' | 'anthropic' | ''
      >;
      setProviderPreference: (
        provider: 'gemini' | 'openai' | 'anthropic',
      ) => Promise<{ success: boolean; provider: string }>;
      generateText: (payload: {
        provider?: 'gemini' | 'openai' | 'anthropic';
        prompt: string;
        geminiConfig?: {
          responseMimeType?: string;
          responseSchema?: object;
        };
      }) => Promise<string>;
      transcribeAudio: (payload: {
        provider?: 'gemini' | 'openai' | 'anthropic';
        audioBase64: string;
        mimeType: string;
      }) => Promise<string>;
      generateVideo: (payload: {
        prompt: string;
      }) => Promise<{ buffer: ArrayBuffer; contentType: string }>;
      installSkill: () => Promise<
        Result<
          { installedAt: string; files: string[] },
          { code: string; message: string }
        >
      >;
    };
  }
}
