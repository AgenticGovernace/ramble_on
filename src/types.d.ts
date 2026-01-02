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
    };
  }
}
