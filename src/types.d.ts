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
      saveKnowledgeBase: (payload: {
        content: string;
        createdAt?: number;
        source?: string;
      }) => Promise<void>;
    };
  }
}
