export {};

declare global {
  interface Window {
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
      onKnowledgeBaseUpdated: (callback: () => void) => void;
    };
  }
}
