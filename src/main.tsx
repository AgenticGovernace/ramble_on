/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {GoogleGenAI, Type} from '@google/genai';
import {marked} from 'marked';

const MODEL_NAME = 'gemini-3-pro-preview';
interface Note {
  id: string;
  title: string;
  rawTranscription: string;
  polishedNote: string;
  timestamp: number;
}

interface KnowledgeBaseItem {
  type: 'folder' | 'file';
  name: string;
  children?: KnowledgeBaseItem[];
  content?: string;
  isOpen?: boolean;
  path?: string;
}


class VoiceNotesApp {
  private mediaRecorder: MediaRecorder | null = null;
  private recordButton: HTMLButtonElement;
  private recordingStatus: HTMLDivElement;
  private rawTranscription: HTMLDivElement;
  private polishedNote: HTMLDivElement;
  private newButton: HTMLButtonElement;
  private deleteNoteButton: HTMLButtonElement;
  private saveNotesButton: HTMLButtonElement;
  private loadNotesButton: HTMLButtonElement;
  private themeToggleButton: HTMLButtonElement;
  private themeToggleIcon: HTMLElement;
  private audioChunks: Blob[] = [];
  private isRecording = false;

  private notes: Note[] = [];
  private activeNoteIndex: number = -1;

  private stream: MediaStream | null = null;
  private editorTitle: HTMLDivElement;
  private hasAttemptedPermission = false;

  private recordingInterface: HTMLDivElement;
  private liveRecordingTitle: HTMLDivElement;
  private liveWaveformCanvas: HTMLCanvasElement;
  private liveWaveformCtx: CanvasRenderingContext2D | null = null;
  private liveRecordingTimerDisplay: HTMLDivElement;
  private statusIndicatorDiv: HTMLDivElement | null;
  private noteTimestamp: HTMLDivElement;

  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private frequencyDataArray: Uint8Array | null = null;
  private timeDomainDataArray: Uint8Array | null = null;
  private waveformDrawingId: number | null = null;
  private timerIntervalId: number | null = null;
  private recordingStartTime: number = 0;

  private currentAudioBlob: Blob | null = null;
  private audioPlayer: HTMLAudioElement;
  private playbackControls: HTMLDivElement;
  // FIX: Corrected typo from `HTMLButtonButtonElement` to `HTMLButtonElement`.
  private playPauseButton: HTMLButtonElement;
  private seekBar: HTMLInputElement;
  private currentTimeDisplay: HTMLSpanElement;
  private totalDurationDisplay: HTMLSpanElement;
  private downloadButton: HTMLButtonElement;

  private isAppendMode = false;
  private recordingMode: 'note' | 'atp' | 'medium' = 'note';
  private appendModeToggle: HTMLInputElement;
  private recordingSessionId: string | null = null;
  
  private readAloudButton: HTMLButtonElement;
  private generateVideoButton: HTMLButtonElement;
  private formatATPButton: HTMLButtonElement;
  private formatMediumButton: HTMLButtonElement;
  private refreshPolishedButton: HTMLButtonElement;

  private videoModal: HTMLDivElement;
  private closeModalButton: HTMLButtonElement;
  private modalTitle: HTMLHeadingElement;
  private modalLoadingState: HTMLDivElement;
  private modalStatusText: HTMLParagraphElement;
  private modalResultState: HTMLDivElement;
  private generatedVideo: HTMLVideoElement;
  private videoDownloadLink: HTMLAnchorElement;
  private modalErrorState: HTMLDivElement;
  private modalErrorText: HTMLParagraphElement;

  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  private knowledgeBaseSidebar: HTMLDivElement;
  private resizer: HTMLDivElement;
  private folderTreeContainer: HTMLDivElement;
  private knowledgeBaseTab: HTMLButtonElement;
  private knowledgeBaseContent: HTMLDivElement;
  private kbContentDisplay: HTMLDivElement;
  private kbContentEditor: HTMLTextAreaElement;
  private saveKbButton: HTMLButtonElement;
  private currentKbFile: KnowledgeBaseItem | null = null;

  private openKbManagerButton: HTMLButtonElement;
  private kbManagerModal: HTMLDivElement;
  private closeKbManagerButton: HTMLButtonElement;
  private kbManagerTree: HTMLDivElement;
  private kbManagerSelectedPath: HTMLDivElement;
  private kbManagerNewFolder: HTMLButtonElement;
  private kbManagerNewFile: HTMLButtonElement;
  private kbManagerRename: HTMLButtonElement;
  private kbManagerDelete: HTMLButtonElement;
  private kbManagerOpen: HTMLButtonElement;
  private kbManagerForm: HTMLDivElement;
  private kbManagerFormTitle: HTMLDivElement;
  private kbManagerFormName: HTMLInputElement;
  private kbManagerFormCancel: HTMLButtonElement;
  private kbManagerFormConfirm: HTMLButtonElement;
  private kbManagerFormHint: HTMLDivElement;
  private kbManagerSelectedItem: KnowledgeBaseItem | null = null;
  private kbManagerFormMode: 'new-folder' | 'new-file' | 'rename' | 'delete' | null = null;

  private tabContainer: HTMLElement;
  private tabButtons: NodeListOf<HTMLButtonElement>;
  private activeTabIndicator: HTMLDivElement;
  private noteContents: NodeListOf<HTMLDivElement>;

  private visualizationType: 'bars' | 'waveform' | 'spectrogram' = 'bars';
  private colorScheme: 'red' | 'blue' | 'sunset' | 'mono' = 'red';
  private visualizationControls: HTMLDivElement | null;
  private vizTypeSelector: HTMLDivElement | null;
  private vizColorSelector: HTMLDivElement | null;
  private liveSpectrogramCanvas: HTMLCanvasElement;
  private liveSpectrogramCtx: CanvasRenderingContext2D | null = null;
  
  private readonly VIDEO_STATUS_MESSAGES = [
    "Warming up the creative engine...",
    "Gathering inspiration...",
    "Directing the digital actors...",
    "Rendering the first few frames...",
    "This can take a few minutes, please wait...",
    "Applying visual effects...",
    "Composing the soundtrack...",
    "Finalizing the edit...",
  ];
  
  private knowledgeBaseData: KnowledgeBaseItem[] = [
    { type: 'folder', name: 'Projects', children: [
      { type: 'folder', name: 'Codex_Experiments', children: [
        { type: 'file', name: 'cli_trigger.py', content: 'import argparse\n\ndef main():\n    parser = argparse.ArgumentParser(description="A simple CLI tool.")\n    parser.add_argument("--name", default="World", help="Name to greet.")\n    args = parser.parse_args()\n    print(f"Hello, {args.name}!")\n\nif __name__ == "__main__":\n    main()' },
        { type: 'file', name: 'README.md', content: '# Codex Experiments\n\nThis project contains various experiments related to code generation and AI-assisted development.\n\n- `cli_trigger.py`: A basic command-line interface.' },
      ]},
      { type: 'folder', name: 'Website_Redesign_2024', children: [
        { type: 'file', name: 'design_brief.md', content: '# Website Redesign Brief\n\n**Goal:** Modernize the user interface and improve mobile responsiveness.\n\n**Key Areas:**\n- Homepage\n- Product Pages\n- Checkout Flow' },
        { type: 'file', name: 'moodboard_notes.md', content: '## Moodboard Notes\n\n- **Color Palette:** Focus on blues and greens, with a bright accent color (orange or yellow).\n- **Typography:** Use a clean sans-serif font like Inter.\n- **Inspiration:** Stripe, Linear, Vercel' },
      ]},
    ]},
    { type: 'folder', name: 'Research', children: [
      { type: 'folder', name: 'Neuroscience', children: [
        { type: 'file', name: 'MemoryModels_summary.md', content: '### Summary of Memory Models\n\n- **Atkinson-Shiffrin Model:** Sensory -> Short-Term -> Long-Term.\n- **Baddeley\'s Model of Working Memory:** Central Executive, Phonological Loop, Visuospatial Sketchpad.' },
      ]},
      { type: 'file', name: 'Quantum_Computing_notes.txt', content: 'Key Concepts in Quantum Computing:\n\n1.  Qubit: Basic unit of quantum information. Can be 0, 1, or a superposition of both.\n2.  Superposition: The ability of a quantum system to be in multiple states at the same time.\n3.  Entanglement: A phenomenon where two or more qubits become linked in such a way that their fates are intertwined, no matter the distance separating them.' },
    ]},
    { type: 'folder', name: 'Personal', children: [
      { type: 'file', name: 'goals_2025.md', content: '# 2025 Goals\n\n- [ ] Run a 10k race\n- [ ] Read 24 books\n- [ ] Learn a new programming language (Rust or Go)' },
    ]},
  ];


  constructor() {
    this.recordButton = document.getElementById(
      'recordButton',
    ) as HTMLButtonElement;
    this.recordingStatus = document.getElementById(
      'recordingStatus',
    ) as HTMLDivElement;
    this.rawTranscription = document.getElementById(
      'rawTranscription',
    ) as HTMLDivElement;
    this.polishedNote = document.getElementById(
      'polishedNote',
    ) as HTMLDivElement;
    this.newButton = document.getElementById('newButton') as HTMLButtonElement;
    this.deleteNoteButton = document.getElementById('deleteNoteButton') as HTMLButtonElement;
    this.saveNotesButton = document.getElementById('saveNotesButton') as HTMLButtonElement;
    this.loadNotesButton = document.getElementById('loadNotesButton') as HTMLButtonElement;
    this.themeToggleButton = document.getElementById(
      'themeToggleButton',
    ) as HTMLButtonElement;
    this.themeToggleIcon = this.themeToggleButton.querySelector(
      'i',
    ) as HTMLElement;
    this.editorTitle = document.querySelector(
      '.editor-title',
    ) as HTMLDivElement;
    this.noteTimestamp = document.getElementById('noteTimestamp') as HTMLDivElement;

    this.recordingInterface = document.querySelector(
      '.recording-interface',
    ) as HTMLDivElement;
    this.liveRecordingTitle = document.getElementById(
      'liveRecordingTitle',
    ) as HTMLDivElement;
    this.liveWaveformCanvas = document.getElementById(
      'liveWaveformCanvas',
    ) as HTMLCanvasElement;
    this.liveRecordingTimerDisplay = document.getElementById(
      'liveRecordingTimerDisplay',
    ) as HTMLDivElement;
    
    this.playbackControls = document.getElementById('playbackControls') as HTMLDivElement;
    this.playPauseButton = document.getElementById('playPauseButton') as HTMLButtonElement;
    this.seekBar = document.getElementById('seekBar') as HTMLInputElement;
    this.currentTimeDisplay = document.getElementById('currentTime') as HTMLSpanElement;
    this.totalDurationDisplay = document.getElementById('totalDuration') as HTMLSpanElement;
    this.downloadButton = document.getElementById('downloadButton') as HTMLButtonElement;

    this.appendModeToggle = document.getElementById('appendModeToggle') as HTMLInputElement;
    this.audioPlayer = new Audio();
    
    this.readAloudButton = document.getElementById('readAloudButton') as HTMLButtonElement;
    this.generateVideoButton = document.getElementById('generateVideoButton') as HTMLButtonElement;
    this.formatATPButton = document.getElementById('formatATPButton') as HTMLButtonElement;
    this.formatMediumButton = document.getElementById('formatMediumButton') as HTMLButtonElement;
    this.refreshPolishedButton = document.getElementById('refreshPolishedButton') as HTMLButtonElement;
    this.videoModal = document.getElementById('videoModal') as HTMLDivElement;
    this.closeModalButton = document.getElementById('closeModalButton') as HTMLButtonElement;
    this.modalTitle = document.getElementById('modalTitle') as HTMLHeadingElement;
    this.modalLoadingState = document.getElementById('modalLoadingState') as HTMLDivElement;
    this.modalStatusText = document.getElementById('modalStatusText') as HTMLParagraphElement;
    this.modalResultState = document.getElementById('modalResultState') as HTMLDivElement;
    this.generatedVideo = document.getElementById('generatedVideo') as HTMLVideoElement;
    this.videoDownloadLink = document.getElementById('videoDownloadLink') as HTMLAnchorElement;
    this.modalErrorState = document.getElementById('modalErrorState') as HTMLDivElement;
    this.modalErrorText = document.getElementById('modalErrorText') as HTMLParagraphElement;

    this.knowledgeBaseSidebar = document.getElementById('knowledgeBaseSidebar') as HTMLDivElement;
    this.resizer = document.getElementById('resizer') as HTMLDivElement;
    this.folderTreeContainer = document.getElementById('folderTree') as HTMLDivElement;
    this.knowledgeBaseTab = document.getElementById('knowledgeBaseTab') as HTMLButtonElement;
    this.knowledgeBaseContent = document.getElementById('knowledgeBaseContent') as HTMLDivElement;
    this.kbContentDisplay = document.getElementById('kbContentDisplay') as HTMLDivElement;
    this.kbContentEditor = document.getElementById('kbContentEditor') as HTMLTextAreaElement;
    this.saveKbButton = document.getElementById('saveKbButton') as HTMLButtonElement;

    this.openKbManagerButton = document.getElementById('openKbManagerButton') as HTMLButtonElement;
    this.kbManagerModal = document.getElementById('kbManagerModal') as HTMLDivElement;
    this.closeKbManagerButton = document.getElementById('closeKbManagerButton') as HTMLButtonElement;
    this.kbManagerTree = document.getElementById('kbManagerTree') as HTMLDivElement;
    this.kbManagerSelectedPath = document.getElementById('kbManagerSelectedPath') as HTMLDivElement;
    this.kbManagerNewFolder = document.getElementById('kbManagerNewFolder') as HTMLButtonElement;
    this.kbManagerNewFile = document.getElementById('kbManagerNewFile') as HTMLButtonElement;
    this.kbManagerRename = document.getElementById('kbManagerRename') as HTMLButtonElement;
    this.kbManagerDelete = document.getElementById('kbManagerDelete') as HTMLButtonElement;
    this.kbManagerOpen = document.getElementById('kbManagerOpen') as HTMLButtonElement;
    this.kbManagerForm = document.getElementById('kbManagerForm') as HTMLDivElement;
    this.kbManagerFormTitle = document.getElementById('kbManagerFormTitle') as HTMLDivElement;
    this.kbManagerFormName = document.getElementById('kbManagerFormName') as HTMLInputElement;
    this.kbManagerFormCancel = document.getElementById('kbManagerFormCancel') as HTMLButtonElement;
    this.kbManagerFormConfirm = document.getElementById('kbManagerFormConfirm') as HTMLButtonElement;
    this.kbManagerFormHint = document.getElementById('kbManagerFormHint') as HTMLDivElement;

    this.tabContainer = document.querySelector('.tab-navigation') as HTMLElement;
    this.tabButtons = this.tabContainer.querySelectorAll('.tab-button');
    this.activeTabIndicator = this.tabContainer.querySelector('.active-tab-indicator') as HTMLDivElement;
    this.noteContents = document.querySelectorAll('.note-content');

    // FIX: Add type assertions to correctly cast the element types.
    this.visualizationControls = document.querySelector('.visualization-controls') as HTMLDivElement | null;
    this.vizTypeSelector = document.getElementById('vizTypeSelector') as HTMLDivElement | null;
    this.vizColorSelector = document.getElementById('vizColorSelector') as HTMLDivElement | null;
    this.liveSpectrogramCanvas = document.getElementById('liveSpectrogramCanvas') as HTMLCanvasElement;

    if (this.liveWaveformCanvas) {
      this.liveWaveformCtx = this.liveWaveformCanvas.getContext('2d');
    }
    if (this.liveSpectrogramCanvas) {
        this.liveSpectrogramCtx = this.liveSpectrogramCanvas.getContext('2d');
    }


    if (this.recordingInterface) {
      this.statusIndicatorDiv = this.recordingInterface.querySelector(
        '.status-indicator',
      ) as HTMLDivElement;
    } else {
      console.warn('Recording interface element not found.');
      this.statusIndicatorDiv = null;
    }

    this.bindEventListeners();
    this.initTheme();
    this.initAppendMode();
    this.initResizer();
    this.buildKnowledgeBasePath(this.knowledgeBaseData);
    this.renderKnowledgeBase();
    void this.loadKnowledgeBaseFromDisk();
    this.registerKnowledgeBaseWatcher();
    this.loadNotesFromStorage();
    requestAnimationFrame(() => {
        const initiallyActiveButton = this.tabContainer.querySelector<HTMLButtonElement>('.tab-button.active');
        if (initiallyActiveButton) {
            this.setActiveTab(initiallyActiveButton, true);
        }
    });
  }

  private get currentNote(): Note | null {
    if (this.activeNoteIndex < 0 || this.activeNoteIndex >= this.notes.length) {
      return null;
    }
    return this.notes[this.activeNoteIndex];
  }
  
  private bindEventListeners(): void {
    this.recordButton.addEventListener('click', () => this.toggleRecording());
    this.newButton.addEventListener('click', () => this.createNewNote());
    this.deleteNoteButton.addEventListener('click', () => this.deleteCurrentNote());
    this.saveNotesButton.addEventListener('click', () => this.saveAllNotes());
    this.loadNotesButton.addEventListener('click', () => this.loadNotesFromStorage());
    this.editorTitle.addEventListener('blur', () => this.saveCurrentNoteTitle());
    this.themeToggleButton.addEventListener('click', () => this.toggleTheme());
    this.appendModeToggle.addEventListener('change', () => this.toggleAppendMode());
    window.addEventListener('resize', this.handleResize.bind(this));

    this.playPauseButton.addEventListener('click', () => this.togglePlayback());
    this.downloadButton.addEventListener('click', () => this.handleDownload());
    this.seekBar.addEventListener('input', () => this.handleSeekBarChange());
    this.audioPlayer.addEventListener('timeupdate', () => this.handleTimeUpdate());
    this.audioPlayer.addEventListener('loadedmetadata', () => this.handleLoadedMetadata());
    this.audioPlayer.addEventListener('ended', () => this.handleAudioEnd());
    
    this.readAloudButton.addEventListener('click', () => this.toggleReadAloud());
    this.generateVideoButton.addEventListener('click', () => this.startVideoGeneration());
    this.formatATPButton.addEventListener('click', () => this.toggleATPRecording());
    this.formatMediumButton.addEventListener('click', () => this.toggleMediumRecording());
    this.refreshPolishedButton.addEventListener('click', () => this.refreshPolishedContent());
    this.saveKbButton.addEventListener('click', () => this.saveKnowledgeBaseFile());
    this.kbContentDisplay.addEventListener('dblclick', () => this.enableKbEditing());
    this.openKbManagerButton.addEventListener('click', () => {
      void this.showKbManager();
    });
    this.closeKbManagerButton.addEventListener('click', () => this.hideKbManager());
    this.kbManagerModal.addEventListener('click', (e) => {
      if (e.target === this.kbManagerModal) {
        this.hideKbManager();
      }
    });
    this.kbManagerNewFolder.addEventListener('click', () => this.openKbManagerForm('new-folder'));
    this.kbManagerNewFile.addEventListener('click', () => this.openKbManagerForm('new-file'));
    this.kbManagerRename.addEventListener('click', () => this.openKbManagerForm('rename'));
    this.kbManagerDelete.addEventListener('click', () => this.openKbManagerForm('delete'));
    this.kbManagerOpen.addEventListener('click', () => this.openKbManagerSelection());
    this.kbManagerFormCancel.addEventListener('click', () => this.closeKbManagerForm());
    this.kbManagerFormConfirm.addEventListener('click', () => {
      void this.submitKbManagerForm();
    });
    this.kbManagerFormName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.submitKbManagerForm();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeKbManagerForm();
      }
    });
    this.closeModalButton.addEventListener('click', () => this.hideVideoModal());
    this.videoModal.addEventListener('click', (e) => {
        if (e.target === this.videoModal) {
            this.hideVideoModal();
        }
    });

    this.bindTabEventListeners();

    this.vizTypeSelector?.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      if (target.tagName === 'BUTTON') {
          this.setVisualizationType(target.dataset.viz as any);
      }
    });
    this.vizColorSelector?.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        if (target.tagName === 'BUTTON') {
            this.setColorScheme(target.dataset.color as any);
        }
    });
  }

  private bindTabEventListeners(): void {
    this.tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            this.setActiveTab(button);
        });
    });

    window.addEventListener('resize', () => {
      requestAnimationFrame(() => {
        const currentActiveButton = this.tabContainer.querySelector<HTMLButtonElement>('.tab-button.active');
        if (currentActiveButton) {
          this.setActiveTab(currentActiveButton, true);
        }
      });
    });
  }

  private setActiveTab(activeButton: HTMLButtonElement | null, skipAnimation = false): void {
      if (!activeButton || !this.activeTabIndicator) return;

      this.tabButtons.forEach(btn => btn.classList.remove('active'));
      activeButton.classList.add('active');

      const tabName = activeButton.getAttribute('data-tab');
      this.noteContents.forEach(content => content.classList.remove('active'));

      const contentToShow = document.querySelector(`.note-content[data-tab="${tabName}"]`);
      if (contentToShow) {
          contentToShow.classList.add('active');
      }

      const originalTransition = this.activeTabIndicator.style.transition;
      if (skipAnimation) {
        this.activeTabIndicator.style.transition = 'none';
      } else {
        this.activeTabIndicator.style.transition = '';
      }

      this.activeTabIndicator.style.left = `${activeButton.offsetLeft}px`;
      this.activeTabIndicator.style.width = `${activeButton.offsetWidth}px`;

      if (skipAnimation) {
        // Force reflow to apply styles immediately
        this.activeTabIndicator.offsetHeight;
        this.activeTabIndicator.style.transition = originalTransition;
      }
  }
  
  private initAppendMode(): void {
    const savedAppendMode = localStorage.getItem('appendMode');
    this.isAppendMode = savedAppendMode === 'true';
    this.appendModeToggle.checked = this.isAppendMode;
  }

  private initResizer(): void {
    const sidebar = this.knowledgeBaseSidebar;
    const resizer = this.resizer;
    const mainContent = document.querySelector('.main-content') as HTMLElement;
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        resizer.classList.add('is-dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const mouseMoveHandler = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = e.clientX - sidebar.getBoundingClientRect().left;
            sidebar.style.width = `${newWidth}px`;
        };

        const mouseUpHandler = () => {
            isResizing = false;
            resizer.classList.remove('is-dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    });
  }

  private buildKnowledgeBasePath(items: KnowledgeBaseItem[], parentPath = ''): void {
      items.forEach(item => {
          const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;
          item.path = currentPath;
          if (item.type === 'folder') {
              if (typeof item.isOpen !== 'boolean') {
                item.isOpen = false;
              }
              if (item.children) {
                  this.buildKnowledgeBasePath(item.children, currentPath);
              }
          }
      });
  }

  private renderKnowledgeBase(): void {
    this.folderTreeContainer.innerHTML = '';
    const treeRoot = this.createTreeElement(this.knowledgeBaseData);
    treeRoot.classList.add('folder-tree');
    this.folderTreeContainer.appendChild(treeRoot);
  }

  private renderKbManagerTree(): void {
    this.kbManagerTree.innerHTML = '';
    const treeRoot = this.createKbManagerTreeElement(this.knowledgeBaseData);
    treeRoot.classList.add('folder-tree');
    this.kbManagerTree.appendChild(treeRoot);
  }

  private createTreeElement(items: KnowledgeBaseItem[]): HTMLUListElement {
      const ul = document.createElement('ul');
      items.forEach(item => {
          const li = document.createElement('li');
          li.className = `tree-item-wrapper ${item.type === 'folder' ? 'folder-item' : 'file-item'}`;
          if (item.type === 'folder' && item.isOpen) {
              li.classList.add('open');
          }

          const itemDiv = document.createElement('div');
          itemDiv.className = 'tree-item';
          
          const icon = document.createElement('i');
          if (item.type === 'folder') {
              icon.className = 'fas fa-fw fa-chevron-right';
          } else {
              // Add a spacer to align files with folders that have a chevron
              const spacer = document.createElement('span');
              spacer.style.width = '1em';
              spacer.style.marginRight = '8px'; // Corresponds to .fa-fw width + gap
              spacer.style.display = 'inline-block';
              itemDiv.appendChild(spacer);
          }
          
          const typeIcon = document.createElement('i');
          typeIcon.className = `fas fa-fw ${item.type === 'folder' ? 'fa-folder' : 'fa-file-alt'}`;
          
          const nameSpan = document.createElement('span');
          nameSpan.textContent = item.name;

          if (item.type === 'folder') {
              itemDiv.appendChild(icon);
          }
          itemDiv.appendChild(typeIcon);
          itemDiv.appendChild(nameSpan);
          li.appendChild(itemDiv);

          itemDiv.addEventListener('click', () => {
              if (item.type === 'folder') {
                  this.toggleFolder(item);
              } else {
                  this.openKnowledgeBaseFile(item);
              }
          });

          if (item.children && item.children.length > 0) {
            const childrenUl = this.createTreeElement(item.children);
            li.appendChild(childrenUl);
          }
          ul.appendChild(li);
      });
      return ul;
  }

  private createKbManagerTreeElement(items: KnowledgeBaseItem[]): HTMLUListElement {
    const ul = document.createElement('ul');
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = `tree-item-wrapper ${item.type === 'folder' ? 'folder-item' : 'file-item'}`;
      if (item.type === 'folder' && item.isOpen) {
        li.classList.add('open');
      }

      const itemDiv = document.createElement('div');
      itemDiv.className = 'tree-item';
      if (this.kbManagerSelectedItem?.path && item.path === this.kbManagerSelectedItem.path) {
        itemDiv.classList.add('selected');
      }

      const icon = document.createElement('i');
      if (item.type === 'folder') {
        icon.className = 'fas fa-fw fa-chevron-right';
      } else {
        const spacer = document.createElement('span');
        spacer.style.width = '1em';
        spacer.style.marginRight = '8px';
        spacer.style.display = 'inline-block';
        itemDiv.appendChild(spacer);
      }

      const typeIcon = document.createElement('i');
      typeIcon.className = `fas fa-fw ${item.type === 'folder' ? 'fa-folder' : 'fa-file-alt'}`;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name;

      if (item.type === 'folder') {
        itemDiv.appendChild(icon);
      }
      itemDiv.appendChild(typeIcon);
      itemDiv.appendChild(nameSpan);
      li.appendChild(itemDiv);

      itemDiv.addEventListener('click', () => {
        this.kbManagerSelectedItem = item;
        this.updateKbManagerSelectionUI();
        if (item.type === 'folder') {
          item.isOpen = !item.isOpen;
        }
        this.renderKbManagerTree();
      });

      if (item.children && item.children.length > 0) {
        const childrenUl = this.createKbManagerTreeElement(item.children);
        li.appendChild(childrenUl);
      }
      ul.appendChild(li);
    });
    return ul;
  }

  private toggleFolder(folderItem: KnowledgeBaseItem): void {
      folderItem.isOpen = !folderItem.isOpen;
      this.renderKnowledgeBase();
  }

  private async openKnowledgeBaseFile(fileItem: KnowledgeBaseItem): Promise<void> {
    this.currentKbFile = fileItem;
    this.knowledgeBaseTab.textContent = fileItem.name;
    this.knowledgeBaseTab.title = fileItem.path || fileItem.name;
    this.knowledgeBaseTab.style.display = 'inline-block';

    this.kbContentDisplay.innerHTML = '';
    this.kbContentDisplay.style.display = 'block';
    this.kbContentEditor.style.display = 'none';
    this.saveKbButton.style.display = 'none';

    if (fileItem.name.endsWith('.md') && fileItem.content) {
        this.kbContentDisplay.classList.add('is-markdown');
        this.kbContentDisplay.innerHTML = await marked.parse(fileItem.content);
    } else {
        this.kbContentDisplay.classList.remove('is-markdown');
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = fileItem.content || 'File is empty.';
        pre.appendChild(code);
        this.kbContentDisplay.appendChild(pre);
    }

    this.setActiveTab(this.knowledgeBaseTab);
  }

  private enableKbEditing(): void {
    if (!this.currentKbFile) return;

    this.kbContentDisplay.style.display = 'none';
    this.kbContentEditor.style.display = 'block';
    this.kbContentEditor.value = this.currentKbFile.content || '';
    this.saveKbButton.style.display = 'inline-block';
    this.kbContentEditor.focus();
  }

  private async saveKnowledgeBaseFile(): Promise<void> {
    if (!this.currentKbFile || !this.currentKbFile.path) {
      alert('No Knowledge Base file is currently open.');
      return;
    }

    if (!window.rambleOnDB?.writeKnowledgeBaseFile) {
      alert('Knowledge Base writing is only available in desktop mode.');
      return;
    }

    const newContent = this.kbContentEditor.value;

    try {
      this.recordingStatus.textContent = 'Saving Knowledge Base file...';

      await window.rambleOnDB.writeKnowledgeBaseFile({
        relativePath: this.currentKbFile.path,
        content: newContent
      });

      this.currentKbFile.content = newContent;

      this.kbContentDisplay.innerHTML = '';
      if (this.currentKbFile.name.endsWith('.md')) {
        this.kbContentDisplay.classList.add('is-markdown');
        this.kbContentDisplay.innerHTML = await marked.parse(newContent);
      } else {
        this.kbContentDisplay.classList.remove('is-markdown');
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = newContent || 'File is empty.';
        pre.appendChild(code);
        this.kbContentDisplay.appendChild(pre);
      }

      this.kbContentDisplay.style.display = 'block';
      this.kbContentEditor.style.display = 'none';
      this.saveKbButton.style.display = 'none';

      this.recordingStatus.textContent = 'Knowledge Base file saved successfully.';
    } catch (error) {
      console.error('Error saving Knowledge Base file:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      this.recordingStatus.textContent = `Error saving file: ${errorMessage}`;
      alert(`Failed to save Knowledge Base file: ${errorMessage}`);
    }
  }

  private serializeKnowledgeBase(items: KnowledgeBaseItem[], depth = 0): string {
    let result = '';
    const indent = '  '.repeat(depth);
    items.forEach(item => {
        if (item.type === 'folder') {
            result += `${indent}📁 ${item.name}/\n`;
            if (item.children) {
                result += this.serializeKnowledgeBase(item.children, depth + 1);
            }
        } else {
            result += `${indent}📄 ${item.name}\n`;
            if (item.content) {
                // Indent content to show it belongs to file
                const contentSnippet = item.content.split('\n').map(line => `${indent}  | ${line}`).join('\n');
                result += `${contentSnippet}\n`;
            }
        }
    });
    return result;
  }

  private generateUuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `note_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private ensureNoteId(note: Note): void {
    if (!note.id || note.id.startsWith('note_')) {
      note.id = this.generateUuid();
    }
  }

  private prepareRecordingSession(): void {
    const currentNote = this.currentNote;
    if (currentNote) {
      this.ensureNoteId(currentNote);
    }

    if (this.isAppendMode) {
      if (!this.recordingSessionId) {
        this.recordingSessionId = currentNote?.id ?? this.generateUuid();
      }
    } else {
      this.recordingSessionId = this.generateUuid();
    }

    void this.persistRecordingSession();
  }

  private async persistRecordingSession(): Promise<void> {
    if (!window.rambleOnDB || !this.recordingSessionId) return;
    await window.rambleOnDB.saveRecording({
      recordingId: this.recordingSessionId,
      noteId: this.currentNote?.id ?? null,
      appendMode: this.isAppendMode,
      createdAt: Date.now(),
    });
  }

  private async persistRawEntry(content: string): Promise<void> {
    if (!window.rambleOnDB || !this.recordingSessionId) return;
    await window.rambleOnDB.saveRawEntry({
      recordingId: this.recordingSessionId,
      noteId: this.currentNote?.id ?? null,
      content,
      createdAt: Date.now(),
    });
  }

  private async persistPolishedEntry(content: string): Promise<void> {
    if (!window.rambleOnDB || !this.recordingSessionId) return;
    await window.rambleOnDB.savePolishedEntry({
      recordingId: this.recordingSessionId,
      noteId: this.currentNote?.id ?? null,
      content,
      createdAt: Date.now(),
    });
  }

  private async loadKnowledgeBaseFromDisk(): Promise<void> {
    if (!window.rambleOnDB?.getKnowledgeBase) return;
    try {
      const payload = await window.rambleOnDB.getKnowledgeBase();
      if (payload?.tree?.length) {
        this.knowledgeBaseData = payload.tree;
        this.buildKnowledgeBasePath(this.knowledgeBaseData);
        this.renderKnowledgeBase();

        if (this.kbManagerModal && !this.kbManagerModal.classList.contains('hidden')) {
          if (this.kbManagerSelectedItem?.path) {
            this.kbManagerSelectedItem = this.findKbItemByPath(this.knowledgeBaseData, this.kbManagerSelectedItem.path);
            this.updateKbManagerSelectionUI();
          }
          this.renderKbManagerTree();
        }

        if (this.currentKbFile?.path) {
          const refreshed = this.findKbItemByPath(this.knowledgeBaseData, this.currentKbFile.path);
          if (refreshed && refreshed.type === 'file') {
            this.currentKbFile = refreshed;
          } else {
            this.closeKbFileTab();
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load knowledge base from disk:', error);
    }
  }

  private registerKnowledgeBaseWatcher(): void {
    if (!window.rambleOnDB?.onKnowledgeBaseUpdated) return;
    window.rambleOnDB.onKnowledgeBaseUpdated(() => {
      void this.loadKnowledgeBaseFromDisk();
    });
  }

  private closeKbFileTab(): void {
    this.currentKbFile = null;
    this.knowledgeBaseTab.style.display = 'none';
    this.knowledgeBaseTab.textContent = 'Knowledge';
    this.knowledgeBaseTab.title = '';
    if (this.kbContentEditor) {
      this.kbContentEditor.style.display = 'none';
    }
    if (this.kbContentDisplay) {
      this.kbContentDisplay.innerHTML = '';
      this.kbContentDisplay.style.display = 'block';
    }
    this.saveKbButton.style.display = 'none';
  }

  private findKbItemByPath(items: KnowledgeBaseItem[], targetPath: string): KnowledgeBaseItem | null {
    for (const item of items) {
      if (item.path === targetPath) return item;
      if (item.type === 'folder' && item.children?.length) {
        const found = this.findKbItemByPath(item.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  }

  private async showKbManager(): Promise<void> {
    if (!window.rambleOnDB?.getKnowledgeBase) {
      alert('Knowledge Base management is only available in desktop mode.');
      return;
    }

    this.kbManagerSelectedItem = null;
    this.updateKbManagerSelectionUI();
    this.kbManagerModal.classList.remove('hidden');
    this.closeKbManagerForm();

    await this.loadKnowledgeBaseFromDisk();
    this.renderKbManagerTree();
  }

  private hideKbManager(): void {
    this.kbManagerModal.classList.add('hidden');
    this.closeKbManagerForm();
  }

  private updateKbManagerSelectionUI(): void {
    const displayPath = this.kbManagerSelectedItem?.path ? `/${this.kbManagerSelectedItem.path}` : '/';
    this.kbManagerSelectedPath.textContent = displayPath;
    const hasSelection = Boolean(this.kbManagerSelectedItem?.path);
    const isFile = this.kbManagerSelectedItem?.type === 'file';
    this.kbManagerRename.disabled = !hasSelection;
    this.kbManagerDelete.disabled = !hasSelection;
    this.kbManagerOpen.disabled = !isFile;
  }

  private getKbManagerParentPath(): string {
    const selected = this.kbManagerSelectedItem;
    if (!selected?.path) return '';
    if (selected.type === 'folder') return selected.path;
    const parts = selected.path.split('/');
    parts.pop();
    return parts.join('/');
  }

  private openKbManagerForm(mode: 'new-folder' | 'new-file' | 'rename' | 'delete'): void {
    if (!window.rambleOnDB) {
      alert('Knowledge Base management is only available in desktop mode.');
      return;
    }

    this.kbManagerFormMode = mode;
    this.kbManagerForm.classList.remove('hidden');

    const selectedName = this.kbManagerSelectedItem?.name ?? '';
    const selectedPath = this.kbManagerSelectedItem?.path ?? '';
    const parentPath = this.getKbManagerParentPath();
    const parentLabel = parentPath ? `/${parentPath}` : '/';

    this.kbManagerFormName.disabled = false;
    this.kbManagerFormName.readOnly = false;

    if (mode === 'new-folder') {
      this.kbManagerFormTitle.textContent = 'Create a new folder';
      this.kbManagerFormConfirm.textContent = 'Create Folder';
      this.kbManagerFormName.value = 'New Folder';
      this.kbManagerFormHint.textContent = `Location: ${parentLabel}`;
    } else if (mode === 'new-file') {
      this.kbManagerFormTitle.textContent = 'Create a new file';
      this.kbManagerFormConfirm.textContent = 'Create File';
      this.kbManagerFormName.value = 'new.md';
      this.kbManagerFormHint.textContent = `Location: ${parentLabel}`;
    } else if (mode === 'rename') {
      if (!selectedPath) return;
      this.kbManagerFormTitle.textContent = 'Rename selected item';
      this.kbManagerFormConfirm.textContent = 'Rename';
      this.kbManagerFormName.value = selectedName;
      this.kbManagerFormHint.textContent = `Current: /${selectedPath}`;
    } else if (mode === 'delete') {
      if (!selectedPath) return;
      this.kbManagerFormTitle.textContent = 'Delete selected item';
      this.kbManagerFormConfirm.textContent = 'Delete';
      this.kbManagerFormName.value = selectedName;
      this.kbManagerFormName.readOnly = true;
      this.kbManagerFormHint.textContent = `This cannot be undone: /${selectedPath}`;
    }

    requestAnimationFrame(() => {
      this.kbManagerFormName.focus();
      if (mode !== 'delete') {
        this.kbManagerFormName.select();
      }
    });
  }

  private closeKbManagerForm(): void {
    this.kbManagerFormMode = null;
    this.kbManagerForm.classList.add('hidden');
    this.kbManagerFormTitle.textContent = '';
    this.kbManagerFormHint.textContent = '';
    this.kbManagerFormName.value = '';
    this.kbManagerFormName.disabled = false;
    this.kbManagerFormName.readOnly = false;
  }

  private async submitKbManagerForm(): Promise<void> {
    if (!window.rambleOnDB) return;
    const mode = this.kbManagerFormMode;
    if (!mode) return;

    const name = this.kbManagerFormName.value.trim();
    const selectedPath = this.kbManagerSelectedItem?.path ?? '';
    const parentPath = this.getKbManagerParentPath();

    try {
      if (mode === 'new-folder') {
        await window.rambleOnDB.createKnowledgeBaseFolder({
          parentPath: parentPath || undefined,
          name,
        });
      } else if (mode === 'new-file') {
        const result = await window.rambleOnDB.createKnowledgeBaseFile({
          parentPath: parentPath || undefined,
          name,
          content: '',
        });
        await this.loadKnowledgeBaseFromDisk();
        const created = this.findKbItemByPath(this.knowledgeBaseData, result.path);
        if (created && created.type === 'file') {
          await this.openKnowledgeBaseFile(created);
          this.enableKbEditing();
          this.hideKbManager();
        }
      } else if (mode === 'rename') {
        if (!selectedPath) return;
        const result = await window.rambleOnDB.renameKnowledgeBasePath({
          relativePath: selectedPath,
          newName: name,
        });
        await this.loadKnowledgeBaseFromDisk();
        if (this.currentKbFile?.path === selectedPath) {
          const refreshed = this.findKbItemByPath(this.knowledgeBaseData, result.path);
          if (refreshed && refreshed.type === 'file') {
            await this.openKnowledgeBaseFile(refreshed);
          } else {
            this.closeKbFileTab();
          }
        }
      } else if (mode === 'delete') {
        if (!selectedPath) return;
        await window.rambleOnDB.deleteKnowledgeBasePath({ relativePath: selectedPath });
        if (this.currentKbFile?.path === selectedPath) {
          this.closeKbFileTab();
        }
        this.kbManagerSelectedItem = null;
        this.updateKbManagerSelectionUI();
      }

      this.closeKbManagerForm();
      await this.loadKnowledgeBaseFromDisk();
      this.renderKbManagerTree();
    } catch (error) {
      console.error('KB operation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      alert(`Knowledge Base operation failed: ${errorMessage}`);
    }
  }

  private openKbManagerSelection(): void {
    const selected = this.kbManagerSelectedItem;
    if (!selected || selected.type !== 'file') return;
    void this.openKnowledgeBaseFile(selected);
    this.hideKbManager();
  }

  private toggleAppendMode(): void {
    this.isAppendMode = this.appendModeToggle.checked;
    localStorage.setItem('appendMode', String(this.isAppendMode));
    this.recordingSessionId = this.isAppendMode ? this.currentNote?.id ?? null : null;
    void this.persistRecordingSession();
  }

  private handleResize(): void {
    if (this.isRecording) {
      requestAnimationFrame(() => {
        if (this.visualizationType === 'spectrogram') {
          this.setupCanvasDimensions(this.liveSpectrogramCanvas);
        } else {
          this.setupCanvasDimensions(this.liveWaveformCanvas);
        }
      });
    }

    const currentActiveButton = this.tabContainer.querySelector<HTMLButtonElement>('.tab-button.active');
    if (currentActiveButton) {
        this.setActiveTab(currentActiveButton, true);
    }
  }

  private setupCanvasDimensions(canvas: HTMLCanvasElement): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      this.themeToggleIcon.classList.remove('fa-sun');
      this.themeToggleIcon.classList.add('fa-moon');
    } else {
      document.body.classList.remove('light-mode');
      this.themeToggleIcon.classList.remove('fa-moon');
      this.themeToggleIcon.classList.add('fa-sun');
    }
  }

  private toggleTheme(): void {
    document.body.classList.toggle('light-mode');
    if (document.body.classList.contains('light-mode')) {
      localStorage.setItem('theme', 'light');
      this.themeToggleIcon.classList.remove('fa-sun');
      this.themeToggleIcon.classList.add('fa-moon');
    } else {
      localStorage.setItem('theme', 'dark');
      this.themeToggleIcon.classList.remove('fa-moon');
      this.themeToggleIcon.classList.add('fa-sun');
    }
  }

  private async toggleRecording(): Promise<void> {
    if (!this.isRecording) {
      await this.startRecording();
    } else {
      await this.stopRecording();
    }
  }

  private async toggleATPRecording(): Promise<void> {
    const noteText = this.polishedNote.innerText;
    if (!noteText || this.polishedNote.classList.contains('placeholder-active')) {
      alert('Please create a note first before formatting as ATP.');
      return;
    }

    if (this.isRecording) {
      if (this.recordingMode === 'atp') {
        await this.stopRecording();
      } else {
        alert('Please finish your current recording first.');
      }
    } else {
      this.recordingMode = 'atp';
      this.formatATPButton.classList.add('speaking');
      const icon = this.formatATPButton.querySelector('i');
      if (icon) {
          icon.classList.remove('fa-brain');
          icon.classList.add('fa-stop');
      }
      await this.startRecording();
    }
  }

  private setupAudioVisualizer(): void {
    if (!this.stream || this.audioContext) return;

    this.audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyserNode = this.audioContext.createAnalyser();

    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.75;

    this.frequencyDataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.timeDomainDataArray = new Uint8Array(this.analyserNode.fftSize);

    source.connect(this.analyserNode);
  }

  private setVisualizationType(type: 'bars' | 'waveform' | 'spectrogram'): void {
    if (!type) return;
    this.visualizationType = type;
    this.vizTypeSelector?.querySelector('.active')?.classList.remove('active');
    this.vizTypeSelector?.querySelector(`[data-viz="${type}"]`)?.classList.add('active');

    if (type === 'spectrogram') {
        this.liveWaveformCanvas!.style.display = 'none';
        this.liveSpectrogramCanvas!.style.display = 'block';
        this.setupCanvasDimensions(this.liveSpectrogramCanvas!);
    } else {
        this.liveWaveformCanvas!.style.display = 'block';
        this.liveSpectrogramCanvas!.style.display = 'none';
        this.setupCanvasDimensions(this.liveWaveformCanvas!);
    }
  }

  private setColorScheme(scheme: 'red' | 'blue' | 'sunset' | 'mono'): void {
      if (!scheme) return;
      this.colorScheme = scheme;
      this.vizColorSelector?.querySelector('.active')?.classList.remove('active');
      this.vizColorSelector?.querySelector(`[data-color="${scheme}"]`)?.classList.add('active');
  }

  private getColorForValue(value: number): string {
    const normalized = value / 255;
    switch (this.colorScheme) {
        case 'blue': // Ocean
            const blueIntensity = 150 + Math.floor(normalized * 105);
            return `rgb(50, 150, ${blueIntensity})`;
        case 'sunset': // Sunset
            // 3-point gradient: dark purple (low) -> orange (mid) -> yellow (high)
            if (normalized < 0.5) { // purple to orange
                const r = Math.round(75 + (255 - 75) * (normalized * 2));
                const g = Math.round(0 + (100 - 0) * (normalized * 2));
                const b = Math.round(130 - (130 - 10) * (normalized * 2));
                return `rgb(${r}, ${g}, ${b})`;
            } else { // orange to yellow
                const r = 255;
                const g = Math.round(100 + (255 - 100) * ((normalized - 0.5) * 2));
                const b = 10;
                return `rgb(${r}, ${g}, ${b})`;
            }
        case 'mono': // Mono
            const shade = Math.floor(normalized * 255);
            return `rgb(${shade}, ${shade}, ${shade})`;
        case 'red': // Fire
        default:
            return getComputedStyle(document.documentElement).getPropertyValue('--color-recording').trim() || '#ff3b30';
    }
  }

  private drawVisualization(): void {
    if (!this.isRecording) {
      if (this.waveformDrawingId) cancelAnimationFrame(this.waveformDrawingId);
      this.waveformDrawingId = null;
      return;
    }
    this.waveformDrawingId = requestAnimationFrame(() => this.drawVisualization());
    
    switch (this.visualizationType) {
        case 'bars':
            this.drawFrequencyBars();
            break;
        case 'waveform':
            this.drawTimeDomainWaveform();
            break;
        case 'spectrogram':
            this.drawSpectrogram();
            break;
    }
  }

  private drawFrequencyBars(): void {
    if (!this.analyserNode || !this.frequencyDataArray || !this.liveWaveformCtx || !this.liveWaveformCanvas) return;
    this.analyserNode.getByteFrequencyData(this.frequencyDataArray);

    const ctx = this.liveWaveformCtx;
    const canvas = this.liveWaveformCanvas;
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    const bufferLength = this.analyserNode.frequencyBinCount;
    const numBars = Math.floor(bufferLength * 0.7);
    if (numBars === 0) return;

    const totalBarPlusSpacingWidth = logicalWidth / numBars;
    const barWidth = Math.max(1, Math.floor(totalBarPlusSpacingWidth * 0.7));
    const barSpacing = Math.max(0, Math.floor(totalBarPlusSpacingWidth * 0.3));
    let x = 0;

    const recordingColor = this.getColorForValue(255); // Get base color for the scheme
    
    for (let i = 0; i < numBars; i++) {
      if (x >= logicalWidth) break;
      const dataIndex = Math.floor(i * (bufferLength / numBars));
      const barHeightNormalized = this.frequencyDataArray[dataIndex] / 255.0;
      let barHeight = barHeightNormalized * logicalHeight;
      if (barHeight < 1 && barHeight > 0) barHeight = 1;

      ctx.fillStyle = this.colorScheme === 'red' ? recordingColor : this.getColorForValue(this.frequencyDataArray[dataIndex]);
      ctx.fillRect(Math.floor(x), logicalHeight - barHeight, barWidth, barHeight);
      x += barWidth + barSpacing;
    }
  }

  private drawTimeDomainWaveform(): void {
    if (!this.analyserNode || !this.timeDomainDataArray || !this.liveWaveformCtx || !this.liveWaveformCanvas) return;
    this.analyserNode.getByteTimeDomainData(this.timeDomainDataArray);

    const ctx = this.liveWaveformCtx;
    const canvas = this.liveWaveformCanvas;
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.getColorForValue(200);
    ctx.beginPath();

    const sliceWidth = logicalWidth * 1.0 / this.analyserNode.fftSize;
    let x = 0;

    for (let i = 0; i < this.analyserNode.fftSize; i++) {
        const v = this.timeDomainDataArray[i] / 128.0;
        const y = v * logicalHeight / 2;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        x += sliceWidth;
    }

    ctx.lineTo(logicalWidth, logicalHeight / 2);
    ctx.stroke();
  }
  
  private drawSpectrogram(): void {
    if (!this.analyserNode || !this.frequencyDataArray || !this.liveSpectrogramCtx || !this.liveSpectrogramCanvas) return;
    this.analyserNode.getByteFrequencyData(this.frequencyDataArray);

    const canvas = this.liveSpectrogramCanvas;
    const ctx = this.liveSpectrogramCtx;
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;

    // Shift the existing image to the left
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(canvas, -1, 0, logicalWidth, logicalHeight);
    ctx.globalCompositeOperation = 'source-over';
    
    const bufferLength = this.analyserNode.frequencyBinCount;
    for (let i = 0; i < bufferLength; i++) {
        const value = this.frequencyDataArray[i];
        const y = logicalHeight - (i / bufferLength) * logicalHeight;
        ctx.fillStyle = this.getColorForValue(value);
        ctx.fillRect(logicalWidth - 1, y, 1, 1);
    }
  }

  private updateLiveTimer(): void {
    if (!this.isRecording || !this.liveRecordingTimerDisplay) return;
    const now = Date.now();
    const elapsedMs = now - this.recordingStartTime;

    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((elapsedMs % 1000) / 10);

    this.liveRecordingTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  }

  private startLiveDisplay(): void {
    if ( !this.recordingInterface || !this.liveRecordingTitle || !this.liveWaveformCanvas || !this.liveRecordingTimerDisplay ) return;

    this.recordingInterface.classList.add('is-live');
    this.liveRecordingTitle.style.display = 'block';
    this.visualizationControls!.style.display = 'flex';
    this.liveRecordingTimerDisplay.style.display = 'block';

    if (this.visualizationType === 'spectrogram') {
      this.liveWaveformCanvas.style.display = 'none';
      this.liveSpectrogramCanvas.style.display = 'block';
      this.setupCanvasDimensions(this.liveSpectrogramCanvas);
    } else {
        this.liveWaveformCanvas.style.display = 'block';
        this.liveSpectrogramCanvas.style.display = 'none';
        this.setupCanvasDimensions(this.liveWaveformCanvas);
    }

    if (this.statusIndicatorDiv) this.statusIndicatorDiv.style.display = 'none';

    const iconElement = this.recordButton.querySelector( '.record-button-inner i') as HTMLElement;
    if (iconElement) {
      iconElement.classList.remove('fa-microphone');
      iconElement.classList.add('fa-stop');
    }

    if (this.recordingMode === 'atp') {
        this.liveRecordingTitle.textContent = 'Recording ATP Instructions...';
    } else {
        const currentTitle = this.editorTitle.textContent?.trim();
        const placeholder = this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
        this.liveRecordingTitle.textContent = currentTitle && currentTitle !== placeholder ? currentTitle : 'New Recording';
    }

    this.setupAudioVisualizer();
    this.drawVisualization();

    this.recordingStartTime = Date.now();
    this.updateLiveTimer();
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.timerIntervalId = window.setInterval(() => this.updateLiveTimer(), 50);
  }

  private stopLiveDisplay(): void {
    if (!this.recordingInterface) return;

    this.recordingInterface.classList.remove('is-live');
    if(this.liveRecordingTitle) this.liveRecordingTitle.style.display = 'none';
    if(this.visualizationControls) this.visualizationControls.style.display = 'none';
    if(this.liveWaveformCanvas) this.liveWaveformCanvas.style.display = 'none';
    if(this.liveSpectrogramCanvas) this.liveSpectrogramCanvas.style.display = 'none';
    if(this.liveRecordingTimerDisplay) this.liveRecordingTimerDisplay.style.display = 'none';

    if (this.statusIndicatorDiv) this.statusIndicatorDiv.style.display = 'block';

    const iconElement = this.recordButton.querySelector('.record-button-inner i') as HTMLElement;
    if (iconElement) {
      iconElement.classList.remove('fa-stop');
      iconElement.classList.add('fa-microphone');
    }

    this.formatATPButton.classList.remove('speaking');
    const atpIcon = this.formatATPButton.querySelector('i');
    if(atpIcon && atpIcon.classList.contains('fa-stop')) {
        atpIcon.classList.remove('fa-stop');
        atpIcon.classList.add('fa-brain');
    }

    this.formatMediumButton.classList.remove('speaking');
    const mediumIcon = this.formatMediumButton.querySelector('i');
    if(mediumIcon && mediumIcon.classList.contains('fa-stop')) {
        mediumIcon.classList.remove('fas', 'fa-stop');
        mediumIcon.classList.add('fab', 'fa-medium');
    }

    if (this.waveformDrawingId) {
      cancelAnimationFrame(this.waveformDrawingId);
      this.waveformDrawingId = null;
    }
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    if (this.liveWaveformCtx && this.liveWaveformCanvas) {
      this.liveWaveformCtx.clearRect(0,0,this.liveWaveformCanvas.width,this.liveWaveformCanvas.height);
    }
    if (this.liveSpectrogramCtx && this.liveSpectrogramCanvas) {
        this.liveSpectrogramCtx.clearRect(0,0,this.liveSpectrogramCanvas.width,this.liveSpectrogramCanvas.height);
    }

    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close().catch((e) => console.warn('Error closing audio context', e));
      }
      this.audioContext = null;
    }
    this.analyserNode = null;
    this.frequencyDataArray = null;
    this.timeDomainDataArray = null;
  }

  private async startRecording(): Promise<void> {
    this.resetPlayback();
    this.prepareRecordingSession();
    try {
      this.audioChunks = [];
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.recordingStatus.textContent = 'Requesting microphone access...';

      try {
        this.stream = await navigator.mediaDevices.getUserMedia({audio: true});
      } catch (err) {
        console.error('Failed with basic constraints:', err);
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }

      try {
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: 'audio/webm',
        });
      } catch (e) {
        console.error('audio/webm not supported, trying default:', e);
        this.mediaRecorder = new MediaRecorder(this.stream);
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0)
          this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        this.stopLiveDisplay();

        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });
          this.processAudio(audioBlob).catch((err) => {
            console.error('Error processing audio:', err);
            this.recordingStatus.textContent = 'Error processing recording';
            if (this.recordingMode === 'atp' || this.recordingMode === 'medium') this.recordingMode = 'note';
          });
        } else {
          this.recordingStatus.textContent =
            'No audio data captured. Please try again.';
          if (this.recordingMode === 'atp' || this.recordingMode === 'medium') this.recordingMode = 'note';
        }

        if (this.stream) {
          this.stream.getTracks().forEach((track) => {
            track.stop();
          });
          this.stream = null;
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      this.recordButton.classList.add('recording');
      this.recordButton.setAttribute('title', 'Stop Recording');

      this.startLiveDisplay();
    } catch (error) {
      console.error('Error starting recording:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';

      if (
        errorName === 'NotAllowedError' ||
        errorName === 'PermissionDeniedError'
      ) {
        this.recordingStatus.textContent =
          'Microphone permission denied. Please check browser settings and reload page.';
      } else if (
        errorName === 'NotFoundError' ||
        (errorName === 'DOMException' &&
          errorMessage.includes('Requested device not found'))
      ) {
        this.recordingStatus.textContent =
          'No microphone found. Please connect a microphone.';
      } else {
        this.recordingStatus.textContent = `Error: ${errorMessage}`;
      }

      this.isRecording = false;
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      this.recordButton.classList.remove('recording');
      this.recordButton.setAttribute('title', 'Start Recording');
      if (this.recordingMode === 'atp' || this.recordingMode === 'medium') this.recordingMode = 'note';
      this.stopLiveDisplay();
    }
  }

  private async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
        this.stopLiveDisplay();
        if (this.recordingMode === 'atp' || this.recordingMode === 'medium') this.recordingMode = 'note';
      }

      this.isRecording = false;

      this.recordButton.classList.remove('recording');
      this.recordButton.setAttribute('title', 'Start Recording');
      this.recordingStatus.textContent = 'Processing audio...';
    } else {
      if (!this.isRecording) this.stopLiveDisplay();
      if (this.recordingMode === 'atp' || this.recordingMode === 'medium') this.recordingMode = 'note';
    }
  }

  private async processAudio(audioBlob: Blob): Promise<void> {
    if (audioBlob.size === 0) {
      this.recordingStatus.textContent =
        'No audio data captured. Please try again.';
      this.resetPlayback();
      if (this.recordingMode === 'atp' || this.recordingMode === 'medium') this.recordingMode = 'note';
      return;
    }
    
    this.currentAudioBlob = audioBlob;
    this.setupAudioPlayer(audioBlob);

    try {
      URL.createObjectURL(audioBlob);

      this.recordingStatus.textContent = 'Converting audio...';

      const reader = new FileReader();
      const readResult = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          try {
            const base64data = reader.result as string;
            const base64Audio = base64data.split(',')[1];
            resolve(base64Audio);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error);
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await readResult;

      if (!base64Audio) throw new Error('Failed to convert audio to base64');

      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
      await this.getTranscription(base64Audio, mimeType);
    } catch (error) {
      console.error('Error in processAudio:', error);
      this.recordingStatus.textContent =
        'Error processing recording. Please try again.';
      if (this.recordingMode === 'atp' || this.recordingMode === 'medium') this.recordingMode = 'note';
    }
  }

  private async getTranscription(
    base64Audio: string,
    mimeType: string,
  ): Promise<void> {
    try {
      this.recordingStatus.textContent = 'Getting transcription...';
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

      const contents = [
        {text: 'Generate a complete, detailed transcript of this audio.'},
        {inlineData: {mimeType: mimeType, data: base64Audio}},
      ];

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
      });

      const transcriptionText = response.text;
      
      if (this.recordingMode === 'atp') {
        if (transcriptionText) {
            this.recordingStatus.textContent = 'Generating ATP Structure...';
            await this.formatAsATP(transcriptionText);
            this.recordingStatus.textContent = 'ATP Formatting Complete.';
        } else {
             this.recordingStatus.textContent = 'No context recorded for ATP.';
        }
        this.recordingMode = 'note';
        const atpIcon = this.formatATPButton.querySelector('i');
        if (atpIcon) {
          atpIcon.classList.remove('fa-stop');
          atpIcon.classList.add('fa-brain');
        }
        this.formatATPButton.classList.remove('speaking');
        return;
      }

      if (this.recordingMode === 'medium') {
        if (transcriptionText) {
            this.recordingStatus.textContent = 'Generating Medium Post...';
            await this.formatAsMediumPost(transcriptionText);
            this.recordingStatus.textContent = 'Medium Post Formatting Complete.';
        } else {
             this.recordingStatus.textContent = 'No context recorded for Medium post.';
        }
        this.recordingMode = 'note';
        const mediumIcon = this.formatMediumButton.querySelector('i');
        if (mediumIcon) {
          mediumIcon.classList.remove('fas', 'fa-stop');
          mediumIcon.classList.add('fab', 'fa-medium');
        }
        this.formatMediumButton.classList.remove('speaking');
        return;
      }

      const currentNote = this.currentNote;

      if (transcriptionText && currentNote) {
          const separator = '\n\n---\n\n';
          const isPlaceholder = this.rawTranscription.classList.contains('placeholder-active');
          if (this.isAppendMode && currentNote.rawTranscription && !isPlaceholder) {
              currentNote.rawTranscription += separator + transcriptionText;
          } else {
              currentNote.rawTranscription = transcriptionText;
          }
          this.rawTranscription.textContent = currentNote.rawTranscription;
          void this.persistRawEntry(currentNote.rawTranscription);
        
        if (this.rawTranscription.textContent.trim()) {
            this.rawTranscription.classList.remove('placeholder-active');
        }

        const wrapper = this.rawTranscription.parentElement as HTMLElement;
        if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;

        this.recordingStatus.textContent =
          'Transcription complete. Polishing note...';
        this.getPolishedNote(transcriptionText).catch((err) => {
          console.error('Error polishing note:', err);
          this.recordingStatus.textContent =
            'Error polishing note after transcription.';
        });
      } else {
        this.recordingStatus.textContent =
          'Transcription failed or returned empty.';
        this.polishedNote.innerHTML =
          '<p><em>Could not transcribe audio. Please try again.</em></p>';
        this.rawTranscription.textContent =
          this.rawTranscription.getAttribute('placeholder');
        this.rawTranscription.classList.add('placeholder-active');
      }
    } catch (error) {
      console.error('Error getting transcription:', error);
      this.recordingStatus.textContent =
        'Error getting transcription. Please try again.';
      this.polishedNote.innerHTML = `<p><em>Error during transcription: ${error instanceof Error ? error.message : String(error)}</em></p>`;
      this.rawTranscription.textContent =
        this.rawTranscription.getAttribute('placeholder');
      this.rawTranscription.classList.add('placeholder-active');
      if (this.recordingMode === 'atp' || this.recordingMode === 'medium') this.recordingMode = 'note';
    }
  }

  private async getPolishedNote(transcriptionToPolish: string): Promise<void> {
    try {
      if (
        !transcriptionToPolish ||
        transcriptionToPolish.trim() === ''
      ) {
        this.recordingStatus.textContent = 'No transcription to polish';
        if (!this.isAppendMode) {
          this.polishedNote.innerHTML =
            '<p><em>No transcription available to polish.</em></p>';
          const placeholder = this.polishedNote.getAttribute('placeholder') || '';
          this.polishedNote.innerHTML = placeholder;
          this.polishedNote.classList.add('placeholder-active');
        }
        return;
      }

      this.recordingStatus.textContent = 'Polishing note...';
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

      const prompt = `Take this raw transcription and create a polished, well-formatted note.
                    Remove filler words (um, uh, like), repetitions, and false starts.
                    Format any lists or bullet points properly. Use markdown formatting for headings, lists, etc.
                    Maintain all the original content and meaning.

                    Raw transcription:
                    ${transcriptionToPolish}`;
      const contents = [{text: prompt}];

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
      });
      const polishedText = response.text;
      const currentNote = this.currentNote;

      if (polishedText && currentNote) {
        const separator = '\n\n---\n\n';
        const isPlaceholder = this.polishedNote.classList.contains('placeholder-active');
        if (this.isAppendMode && currentNote.polishedNote && !isPlaceholder) {
            currentNote.polishedNote += separator + polishedText;
        } else {
            currentNote.polishedNote = polishedText;
        }
        this.polishedNote.innerHTML = await marked.parse(currentNote.polishedNote);
        void this.persistPolishedEntry(currentNote.polishedNote);
        
        if (this.polishedNote.innerText.trim()) {
          this.polishedNote.classList.remove('placeholder-active');
        }

        const wrapper = this.polishedNote.parentElement as HTMLElement;
        if(wrapper) wrapper.scrollTop = wrapper.scrollHeight;

        const isTitlePlaceholder = this.editorTitle.classList.contains('placeholder-active');

        if (isTitlePlaceholder) {
          let noteTitleSet = false;
          const lines = polishedText.split('\n').map((l) => l.trim());

          for (const line of lines) {
            if (line.startsWith('#')) {
              const title = line.replace(/^#+\s+/, '').trim();
              if (this.editorTitle && title) {
                this.editorTitle.textContent = title;
                currentNote.title = title;
                this.editorTitle.classList.remove('placeholder-active');
                noteTitleSet = true;
                break;
              }
            }
          }

          if (!noteTitleSet && this.editorTitle) {
            for (const line of lines) {
              if (line.length > 0) {
                let potentialTitle = line.replace(
                  /^[\*_\`#\->\s\[\]\(.\d)]+/,
                  '',
                );
                potentialTitle = potentialTitle.replace(/[\*_\`#]+$/, '');
                potentialTitle = potentialTitle.trim();

                if (potentialTitle.length > 3) {
                  const maxLength = 60;
                  const finalTitle = potentialTitle.substring(0, maxLength) +
                    (potentialTitle.length > maxLength ? '...' : '');
                  this.editorTitle.textContent = finalTitle;
                  currentNote.title = finalTitle;
                  this.editorTitle.classList.remove('placeholder-active');
                  noteTitleSet = true;
                  break;
                }
              }
            }
          }
        }

        this.recordingStatus.textContent =
          'Note polished. Ready for next recording.';
      } else {
        this.recordingStatus.textContent =
          'Polishing failed or returned empty.';
        if (!this.isAppendMode) {
            this.polishedNote.innerHTML =
                '<p><em>Polishing returned empty. Raw transcription is available.</em></p>';
            if (
            this.polishedNote.textContent?.trim() === '' ||
            this.polishedNote.innerHTML.includes('<em>Polishing returned empty')
            ) {
            const placeholder =
                this.polishedNote.getAttribute('placeholder') || '';
            this.polishedNote.innerHTML = placeholder;
            this.polishedNote.classList.add('placeholder-active');
            }
        }
      }
    } catch (error) {
      console.error('Error polishing note:', error);
      this.recordingStatus.textContent =
        'Error polishing note. Please try again.';
      this.polishedNote.innerHTML += `<p><em>Error during polishing: ${error instanceof Error ? error.message : String(error)}</em></p>`;
    }
  }

  private formatTimestamp(timestamp: number): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private async displayNote(note: Note | null): Promise<void> {
    if (!note) {
      this.noteTimestamp.textContent = '';
      const rawPlaceholder = this.rawTranscription.getAttribute('placeholder') || '';
      this.rawTranscription.textContent = rawPlaceholder;
      this.rawTranscription.classList.add('placeholder-active');
      const polishedPlaceholder = this.polishedNote.getAttribute('placeholder') || '';
      this.polishedNote.innerHTML = polishedPlaceholder;
      this.polishedNote.classList.add('placeholder-active');
      const titlePlaceholder = this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
      this.editorTitle.textContent = titlePlaceholder;
      this.editorTitle.classList.add('placeholder-active');
      return;
    }

    this.noteTimestamp.textContent = this.formatTimestamp(note.timestamp);

    if (note.title && note.title !== 'Untitled Note') {
        this.editorTitle.textContent = note.title;
        this.editorTitle.classList.remove('placeholder-active');
    } else {
        const placeholder = this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
        this.editorTitle.textContent = placeholder;
        this.editorTitle.classList.add('placeholder-active');
    }

    if (note.rawTranscription) {
        this.rawTranscription.textContent = note.rawTranscription;
        this.rawTranscription.classList.remove('placeholder-active');
    } else {
        const placeholder = this.rawTranscription.getAttribute('placeholder') || '';
        this.rawTranscription.textContent = placeholder;
        this.rawTranscription.classList.add('placeholder-active');
    }
    
    if (note.polishedNote) {
        this.polishedNote.innerHTML = await marked.parse(note.polishedNote);
        this.polishedNote.classList.remove('placeholder-active');
    } else {
        const placeholder = this.polishedNote.getAttribute('placeholder') || '';
        this.polishedNote.innerHTML = placeholder;
        this.polishedNote.classList.add('placeholder-active');
    }
    
    this.recordingStatus.textContent = 'Ready to record';
    this.resetPlayback();
  }

  private createNewNote(): void {
    this.resetPlayback();
    const newNote: Note = {
      id: this.generateUuid(),
      title: 'Untitled Note',
      rawTranscription: '',
      polishedNote: '',
      timestamp: Date.now(),
    };
    
    this.notes.push(newNote);
    this.activeNoteIndex = this.notes.length - 1;

    this.displayNote(newNote);
    this.updateDeleteButtonState();
    this.recordingSessionId = null;
    
    if (this.isRecording) {
      this.mediaRecorder?.stop();
      this.isRecording = false;
      this.recordButton.classList.remove('recording');
    } else {
      this.stopLiveDisplay();
    }
  }
  
  private deleteCurrentNote(): void {
    if (this.notes.length <= 1) {
        alert('Cannot delete the only note.');
        return;
    }

    const currentNote = this.currentNote;
    if (currentNote && window.confirm(`Are you sure you want to delete "${currentNote.title || 'Untitled Note'}"?`)) {
        const indexToDelete = this.activeNoteIndex;
        this.notes.splice(indexToDelete, 1);
        
        this.activeNoteIndex = Math.max(0, indexToDelete - 1);
        
        this.displayNote(this.notes[this.activeNoteIndex]);
        this.saveAllNotes(); // Persist the deletion immediately
        this.updateDeleteButtonState();
    }
  }
  
  private saveCurrentNoteTitle(): void {
    const currentNote = this.currentNote;
    if (currentNote && this.editorTitle.textContent) {
        const isPlaceholder = this.editorTitle.classList.contains('placeholder-active');
        if (!isPlaceholder) {
            currentNote.title = this.editorTitle.textContent.trim();
        }
    }
  }

  private saveAllNotes(): void {
      this.saveCurrentNoteTitle();
      try {
          localStorage.setItem('voice-notes-app-data', JSON.stringify(this.notes));
          this.recordingStatus.textContent = 'All notes saved.';
          setTimeout(() => {
              if (this.recordingStatus.textContent === 'All notes saved.') {
                  this.recordingStatus.textContent = 'Ready to record';
              }
          }, 2000);
      } catch (e) {
          console.error("Failed to save notes:", e);
          this.recordingStatus.textContent = 'Error saving notes.';
      }
  }

  private loadNotesFromStorage(): void {
      try {
          const savedNotes = localStorage.getItem('voice-notes-app-data');
          if (savedNotes) {
              this.notes = JSON.parse(savedNotes);
              this.notes.forEach((note) => this.ensureNoteId(note));
              if (this.notes.length > 0) {
                  this.activeNoteIndex = 0;
                  this.displayNote(this.notes[this.activeNoteIndex]);
              } else {
                  this.createNewNote();
              }
          } else {
              this.createNewNote();
          }
      } catch (e) {
          console.error("Failed to load notes:", e);
          this.createNewNote();
      }
      this.updateDeleteButtonState();
  }

  private updateDeleteButtonState(): void {
    this.deleteNoteButton.disabled = this.notes.length <= 1;
  }
  
  private setupAudioPlayer(audioBlob: Blob): void {
    if (this.audioPlayer.src) {
      URL.revokeObjectURL(this.audioPlayer.src);
    }
    this.audioPlayer.src = URL.createObjectURL(audioBlob);

    this.playbackControls.classList.remove('hidden');
    if (this.statusIndicatorDiv) {
      this.statusIndicatorDiv.classList.add('hidden');
    }
  }

  private resetPlayback(): void {
    this.playbackControls.classList.add('hidden');
    if (this.statusIndicatorDiv) {
      this.statusIndicatorDiv.classList.remove('hidden');
    }

    if (!this.audioPlayer.paused) {
      this.audioPlayer.pause();
    }

    if (this.audioPlayer.src) {
      URL.revokeObjectURL(this.audioPlayer.src);
    }
    this.audioPlayer.removeAttribute('src');
    this.audioPlayer.load();

    this.currentAudioBlob = null;
    this.seekBar.value = '0';
    this.currentTimeDisplay.textContent = '00:00';
    this.totalDurationDisplay.textContent = '00:00';

    const icon = this.playPauseButton.querySelector('i');
    if (icon) {
      icon.classList.remove('fa-pause');
      icon.classList.add('fa-play');
    }
  }

  private togglePlayback(): void {
    if (!this.audioPlayer.src || !this.currentAudioBlob) return;

    const icon = this.playPauseButton.querySelector('i');
    if (this.audioPlayer.paused) {
      this.audioPlayer.play();
      if (icon) {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
      }
    } else {
      this.audioPlayer.pause();
      if (icon) {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
      }
    }
  }

  private handleSeekBarChange(): void {
    if (!this.audioPlayer.src || !this.currentAudioBlob) return;
    this.audioPlayer.currentTime = parseFloat(this.seekBar.value);
  }

  private formatTime(timeInSeconds: number): string {
    const seconds = Math.floor(timeInSeconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds,
    ).padStart(2, '0')}`;
  }

  private handleTimeUpdate(): void {
    this.seekBar.value = String(this.audioPlayer.currentTime);
    this.currentTimeDisplay.textContent = this.formatTime(
      this.audioPlayer.currentTime,
    );
  }

  private handleLoadedMetadata(): void {
    this.seekBar.max = String(this.audioPlayer.duration);
    this.totalDurationDisplay.textContent = this.formatTime(
      this.audioPlayer.duration,
    );
  }

  private handleAudioEnd(): void {
    const icon = this.playPauseButton.querySelector('i');
    if (icon) {
      icon.classList.remove('fa-pause');
      icon.classList.add('fa-play');
    }
    this.audioPlayer.currentTime = 0;
  }

  private handleDownload(): void {
    if (!this.currentAudioBlob) return;

    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';

    const url = URL.createObjectURL(this.currentAudioBlob);
    a.href = url;

    const fileExtension = this.currentAudioBlob.type.split('/')[1] || 'webm';
    a.download = `voice-note-${new Date().toISOString()}.${fileExtension}`;
    a.click();

    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  private toggleReadAloud(): void {
    if (this.isSpeaking) {
      window.speechSynthesis.cancel();
      // onend will fire and reset the state.
      return;
    }

    const textToSpeak = this.polishedNote.innerText;

    if (!textToSpeak || this.polishedNote.classList.contains('placeholder-active')) {
      return; // Do nothing if there's no real text to speak
    }

    window.speechSynthesis.cancel(); // Cancel any previous utterances

    this.currentUtterance = new SpeechSynthesisUtterance(textToSpeak);

    this.currentUtterance.onstart = () => {
      this.isSpeaking = true;
      this.readAloudButton.classList.add('speaking');
      this.readAloudButton.title = 'Stop Reading';
      const icon = this.readAloudButton.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-volume-high');
        icon.classList.add('fa-stop');
      }
    };

    const resetSpeechState = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.readAloudButton.classList.remove('speaking');
      this.readAloudButton.title = 'Read Note Aloud';
      const icon = this.readAloudButton.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-stop');
        icon.classList.add('fa-volume-high');
      }
    };

    this.currentUtterance.onend = resetSpeechState;
    this.currentUtterance.onerror = (event) => {
      console.error('SpeechSynthesisUtterance.onerror', event);
      resetSpeechState();
    };

    window.speechSynthesis.speak(this.currentUtterance);
  }

  private async formatAsATP(additionalContext: string = ''): Promise<void> {
    const noteText = this.polishedNote.innerText;

    if (!noteText || this.polishedNote.classList.contains('placeholder-active')) {
      alert('Please create a note first before formatting as ATP.');
      return;
    }

    this.recordingStatus.textContent = 'Formatting as ATP with KB Context...';

    let textToFormat = noteText;
    if (noteText.trim().startsWith('[[Mode]]:')) {
      const separator = '\n---\n';
      const parts = noteText.split(separator);
      if (parts.length > 1) {
        textToFormat = parts.slice(1).join(separator).trim();
      }
    }
    
    if (!textToFormat) {
        this.recordingStatus.textContent = 'No content to format.';
        return;
    }

    // Use the new, content-aware serializer
    const knowledgeBaseContext = this.serializeKnowledgeBase(this.knowledgeBaseData);

    try {
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
      const prompt = `You are an AI assistant specializing in the Artemis Transmission Protocol (ATP) and knowledge synthesis. Your goal is to generate a structured prompt for *another* executing agent. 
      
      **CRITICAL TASK:** You must actively use the user's Knowledge Base (folders, files, and file content) to ground the note. You must identify updates to the Knowledge Base and deep conceptual links. When translating raw ideas into structured output, identify if anything directly ties to this information, or if documents or themes are mentioned, to provide deeper insight into the meaning. This will lead to a better output, offering insights such as "This is similar to what you were thinking here" and highlighting potentially missing information.

**1. Knowledge Base (Context Source):**
Use this structure and content to determine the \`targetZone\`, suggest \`suggestedKbActions\`, and find \`metaLink\` connections.
<KnowledgeBase>
${knowledgeBaseContext}
</KnowledgeBase>

**2. Voice Instruction (User Intent):**
The user provided this specific instruction for handling the note:
"${additionalContext ? additionalContext : "No specific instruction provided. infer best action."}"

**3. Note Content (Raw Data):**
<Note>
${textToFormat}
</Note>

**4. Requirements:**
Generate a JSON object.
- **mode**: (Build, Review, Organize, Capture, Synthesize, Commit).
- **context**: A concise mission goal.
- **priority**: (Critical, High, Normal, Low).
- **actionType**: (Summarize, Scaffold, Execute, Reflect).
- **targetZone**: **(Use KB)** The precise folder path where this belongs.
- **specialNotes**: Instructions, constraints, or warnings.
- **suggestedKbActions**: A list of specific actions the executing agent should take to update the Knowledge Base. 
    - Examples: "Create folder '/Projects/NewApp'", "Append note to '/Research/Ideas.md'", "Move file 'draft.txt' to '/Archive'".
    - If the user's voice instruction implies adding this note to a specific place, list it here.
- **metaLink**: **(Deep Insight)** Analyze the Note's themes against the Knowledge Base content. 
    - Identify a non-obvious relationship.
    - Format: "#tag - /path/to/source - Insight description."`;


      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ text: prompt }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mode: { type: Type.STRING },
              context: { type: Type.STRING },
              priority: { type: Type.STRING },
              actionType: { type: Type.STRING },
              targetZone: { type: Type.STRING },
              specialNotes: { type: Type.STRING },
              suggestedKbActions: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING } 
              },
              metaLink: { type: Type.STRING },
            },
            required: [
              'mode',
              'context',
              'priority',
              'actionType',
              'targetZone',
              'specialNotes',
              'suggestedKbActions',
              'metaLink',
            ],
          },
        },
      });

      const jsonStr = response.text.trim();
      const atpData = JSON.parse(jsonStr);

      // Format the suggested KB actions list
      let kbActionsFormatted = '';
      if (atpData.suggestedKbActions && atpData.suggestedKbActions.length > 0) {
          kbActionsFormatted = '\n[[Suggested KB Actions]]:\n' + atpData.suggestedKbActions.map((action: string) => `- ${action}`).join('\n');
      }

      const formattedATP = `[[Mode]]: ${atpData.mode}
[[Context]]: ${atpData.context}
[[Priority]]: ${atpData.priority}
[[ActionType]]: ${atpData.actionType}
[[TargetZone]]: ${atpData.targetZone}
[[SpecialNotes]]: ${atpData.specialNotes}${kbActionsFormatted}
${atpData.metaLink ? `\n[[MetaLink]]: ${atpData.metaLink}` : ''}

---
**User Instruction:** ${additionalContext || "N/A"}
---

${textToFormat}`;

      const currentNote = this.currentNote;
      if (currentNote) {
        currentNote.polishedNote = formattedATP;
      }
      this.polishedNote.innerHTML = await marked.parse(formattedATP);
      void this.persistPolishedEntry(currentNote?.polishedNote || formattedATP);
      if (this.polishedNote.innerText.trim()) {
        this.polishedNote.classList.remove('placeholder-active');
      }
      
      this.recordingStatus.textContent = 'Note formatted as ATP.';

      const polishedTabButton = document.querySelector(
        '.tab-button[data-tab="note"]',
      );
      if (
        polishedTabButton &&
        !polishedTabButton.classList.contains('active')
      ) {
        this.setActiveTab(polishedTabButton as HTMLButtonElement);
      }
    } catch (error) {
      console.error('Error formatting as ATP:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';
      this.recordingStatus.textContent = `Error formatting: ${errorMessage}`;
    }
  }

  private async toggleMediumRecording(): Promise<void> {
    const noteText = this.polishedNote.innerText;
    if (!noteText || this.polishedNote.classList.contains('placeholder-active')) {
      alert('Please create a note first before formatting as Medium post.');
      return;
    }

    if (this.isRecording) {
      if (this.recordingMode === 'medium') {
        await this.stopRecording();
      } else {
        alert('Please finish your current recording first.');
      }
    } else {
      this.recordingMode = 'medium';
      this.formatMediumButton.classList.add('speaking');
      const icon = this.formatMediumButton.querySelector('i');
      if (icon) {
        icon.classList.remove('fab', 'fa-medium');
        icon.classList.add('fas', 'fa-stop');
      }
      await this.startRecording();
    }
  }

  private async formatAsMediumPost(additionalContext: string = ''): Promise<void> {
    const noteText = this.polishedNote.innerText;

    if (!noteText || this.polishedNote.classList.contains('placeholder-active')) {
      alert('Please create a note first before formatting as Medium post.');
      return;
    }

    this.recordingStatus.textContent = 'Formatting as Medium Post with KB Context...';

    let textToFormat = noteText;
    if (noteText.trim().startsWith('[[Mode]]:')) {
      const separator = '\n---\n';
      const parts = noteText.split(separator);
      if (parts.length > 1) {
        textToFormat = parts.slice(1).join(separator).trim();
      }
    }

    if (!textToFormat) {
      this.recordingStatus.textContent = 'No content to format.';
      return;
    }

    const knowledgeBaseContext = this.serializeKnowledgeBase(this.knowledgeBaseData);

    try {
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
      const prompt = `You are an expert Medium.com content editor and SEO specialist. Transform the user's rambling voice note into a polished, publication-ready Medium post.

**CRITICAL TASK:** Use the Knowledge Base to:
1. Find related topics and posts for internal linking
2. Maintain consistency with the user's existing writing themes
3. Suggest relevant connections to other content
4. Extract topic patterns for better tagging

**1. Knowledge Base (Reference Material):**
Use this to discover related content, identify themes, and suggest internal links.
<KnowledgeBase>
${knowledgeBaseContext}
</KnowledgeBase>

**2. User Instruction (Optional Context):**
"${additionalContext ? additionalContext : "No specific instruction - use your best judgment for Medium optimization."}"

**3. Raw Note Content:**
<Note>
${textToFormat}
</Note>

**4. Output Requirements:**
Generate a JSON object with:
- **title**: SEO-optimized headline (60 chars max, attention-grabbing)
- **subtitle**: Compelling subheading (140 chars max, clarifies value)
- **tags**: Array of 1-5 Medium tags (lowercase, specific topics)
- **sections**: Array of section objects with:
  - sectionTitle: H2 heading
  - content: Restructured content for that section (markdown)
- **relatedKbTopics**: Array of objects with:
  - topicName: Topic from KB
  - kbPath: File/folder path in KB
  - relevance: Why it's related (one sentence)
- **suggestedInternalLinks**: Array of strings suggesting where to link to KB content
- **metaInsight**: One-sentence insight about how this fits into the user's knowledge ecosystem

**Style Guidelines:**
- Use Medium's conversational, storytelling tone
- Break rambling into logical narrative flow
- Add transition phrases between sections
- Use markdown for emphasis (bold, italic, code blocks, quotes)
- Include hook in first paragraph
- End with clear takeaway or call-to-action`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ text: prompt }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sectionTitle: { type: Type.STRING },
                    content: { type: Type.STRING }
                  },
                  required: ['sectionTitle', 'content']
                }
              },
              relatedKbTopics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topicName: { type: Type.STRING },
                    kbPath: { type: Type.STRING },
                    relevance: { type: Type.STRING }
                  },
                  required: ['topicName', 'kbPath', 'relevance']
                }
              },
              suggestedInternalLinks: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              metaInsight: { type: Type.STRING }
            },
            required: [
              'title',
              'subtitle',
              'tags',
              'sections',
              'relatedKbTopics',
              'suggestedInternalLinks',
              'metaInsight'
            ]
          }
        }
      });

      const jsonStr = response.text.trim();
      const mediumData = JSON.parse(jsonStr);

      if (!mediumData.title || !mediumData.sections || mediumData.sections.length === 0) {
        throw new Error('Invalid response format from AI - missing required fields');
      }

      const tagsFormatted = mediumData.tags.map((tag: string) => `#${tag}`).join(' ');

      const sectionsFormatted = mediumData.sections
        .map((section: any) => `## ${section.sectionTitle}\n\n${section.content}`)
        .join('\n\n');

      let relatedTopicsFormatted = '';
      if (mediumData.relatedKbTopics && mediumData.relatedKbTopics.length > 0) {
        relatedTopicsFormatted = '\n\n---\n\n### Related Topics from Your Knowledge Base\n\n' +
          mediumData.relatedKbTopics.map((topic: any) =>
            `- **${topic.topicName}** (${topic.kbPath}): ${topic.relevance}`
          ).join('\n');
      }

      let linksFormatted = '';
      if (mediumData.suggestedInternalLinks && mediumData.suggestedInternalLinks.length > 0) {
        linksFormatted = '\n\n### Suggested Internal Links\n\n' +
          mediumData.suggestedInternalLinks.map((link: string) => `- ${link}`).join('\n');
      }

      const formattedMedium = `# ${mediumData.title}

## ${mediumData.subtitle}

**Tags:** ${tagsFormatted}

---

${sectionsFormatted}

---

${mediumData.metaInsight ? `**Meta Insight:** ${mediumData.metaInsight}\n` : ''}${relatedTopicsFormatted}${linksFormatted}

---

**User Instruction:** ${additionalContext || "N/A"}`;

      const currentNote = this.currentNote;
      if (currentNote) {
        currentNote.polishedNote = formattedMedium;
      }
      this.polishedNote.innerHTML = await marked.parse(formattedMedium);
      void this.persistPolishedEntry(currentNote?.polishedNote || formattedMedium);
      if (this.polishedNote.innerText.trim()) {
        this.polishedNote.classList.remove('placeholder-active');
      }

      this.recordingStatus.textContent = 'Note formatted as Medium Post.';

      const polishedTabButton = document.querySelector('.tab-button[data-tab="note"]');
      if (
        polishedTabButton &&
        !polishedTabButton.classList.contains('active')
      ) {
        this.setActiveTab(polishedTabButton as HTMLButtonElement);
      }
    } catch (error) {
      console.error('Error formatting as Medium post:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';
      this.recordingStatus.textContent = `Error formatting: ${errorMessage}`;

      this.formatMediumButton.classList.remove('speaking');
      const icon = this.formatMediumButton.querySelector('i');
      if (icon) {
        icon.classList.remove('fas', 'fa-stop');
        icon.classList.add('fab', 'fa-medium');
      }
    }
  }

  private async refreshPolishedContent(): Promise<void> {
    const rawText = this.rawTranscription.innerText;

    if (!rawText || this.rawTranscription.classList.contains('placeholder-active')) {
      alert('No raw transcription available to refresh. Please record a note first.');
      return;
    }

    if (this.isRecording) {
      alert('Cannot refresh while recording. Please stop the recording first.');
      return;
    }

    this.recordingStatus.textContent = 'Refreshing polished content from raw transcription...';

    await this.getPolishedNote(rawText);

    const polishedTabButton = document.querySelector('.tab-button[data-tab="note"]');
    if (polishedTabButton && !polishedTabButton.classList.contains('active')) {
      this.setActiveTab(polishedTabButton as HTMLButtonElement);
    }
  }

  private async startVideoGeneration(): Promise<void> {
    const prompt = this.polishedNote.innerText;

    if (!prompt || this.polishedNote.classList.contains('placeholder-active')) {
      alert('Please create a note first before generating a video.');
      return;
    }

    this.updateModalState('loading', { title: 'Generating Your Video', status: this.VIDEO_STATUS_MESSAGES[0] });
    this.showVideoModal();

    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % this.VIDEO_STATUS_MESSAGES.length;
      this.modalStatusText.textContent = this.VIDEO_STATUS_MESSAGES[messageIndex];
    }, 5000);

    try {
      // API Key selection for Veo models
      if (typeof window.aistudio !== 'undefined') {
          if (!await window.aistudio.hasSelectedApiKey()) {
              this.modalStatusText.textContent = 'Please select your API key for video generation.';
              await window.aistudio.openSelectKey();
              // Assume success after openSelectKey; the next API call will fail if not,
              // and error handling will re-prompt.
              this.modalStatusText.textContent = this.VIDEO_STATUS_MESSAGES[0]; // Reset status
          }
      } else {
          console.warn('window.aistudio is not defined. API key selection for Veo models may not function as expected.');
      }
      
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY}); // Initialize here

      let operation = await ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
        },
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }
      
      clearInterval(messageInterval);
      
      this.modalStatusText.textContent = 'Downloading video...';

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
          const fetchUrl = `${downloadLink}&key=${process.env.API_KEY}`;
          const response = await fetch(fetchUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch video file: ${response.status} ${response.statusText}`);
          }
          const videoBlob = await response.blob();
          const videoUrl = URL.createObjectURL(videoBlob);
          this.updateModalState('result', { videoUrl });
      } else {
          throw new Error('Video generation finished, but no video URL was returned.');
      }

    } catch (error) {
      clearInterval(messageInterval);
      console.error('Error generating video:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      
      // Check for API key related errors for Veo model and re-prompt
      if (typeof window.aistudio !== 'undefined' && errorMessage.includes("Requested entity was not found.")) {
          this.modalStatusText.textContent = 'API key invalid or not found. Please re-select your API key.';
          await window.aistudio.openSelectKey();
          this.updateModalState('error', { title: 'Key Selection Required', error: 'Please retry video generation after selecting your API key. (ai.google.dev/gemini-api/docs/billing)' });
      } else {
          this.updateModalState('error', { title: 'Generation Failed', error: errorMessage });
      }
    }
  }

  private showVideoModal(): void {
    this.videoModal.classList.remove('hidden');
  }

  private hideVideoModal(): void {
    this.videoModal.classList.add('hidden');
    this.generatedVideo.pause();
    // Revoke object URL to prevent memory leaks
    if (this.generatedVideo.src && this.generatedVideo.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.generatedVideo.src);
    }
    this.generatedVideo.removeAttribute('src');
    this.videoDownloadLink.removeAttribute('href');
  }

  private updateModalState(state: 'loading' | 'result' | 'error', data: any): void {
      this.modalLoadingState.classList.add('hidden');
      this.modalResultState.classList.add('hidden');
      this.modalErrorState.classList.add('hidden');

      this.modalTitle.textContent = data.title || 'Generating Video';

      switch (state) {
          case 'loading':
              this.modalStatusText.textContent = data.status;
              this.modalLoadingState.classList.remove('hidden');
              break;
          case 'result':
              this.modalTitle.textContent = 'Your Video is Ready!';
              this.generatedVideo.src = data.videoUrl;
              this.videoDownloadLink.href = data.videoUrl;
              this.modalResultState.classList.remove('hidden');
              break;
          case 'error':
              this.modalErrorText.textContent = `Error: ${data.error}`;
              this.modalErrorState.classList.remove('hidden');
              break;
      }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VoiceNotesApp();

  document
    .querySelectorAll<HTMLElement>('[contenteditable][placeholder]')
    .forEach((el) => {
      const placeholder = el.getAttribute('placeholder')!;

      function updatePlaceholderState() {
        const currentText = (
          el.id === 'polishedNote' ? el.innerText : el.textContent
        )?.trim();

        if (currentText === '' || currentText === placeholder) {
          if (el.id === 'polishedNote' && currentText === '') {
            el.innerHTML = placeholder;
          } else if (currentText === '') {
            el.textContent = placeholder;
          }
          el.classList.add('placeholder-active');
        } else {
          el.classList.remove('placeholder-active');
        }
      }

      updatePlaceholderState();

      el.addEventListener('focus', function () {
        const currentText = (
          this.id === 'polishedNote' ? this.innerText : this.textContent
        )?.trim();
        if (currentText === placeholder) {
          if (this.id === 'polishedNote') this.innerHTML = '';
          else this.textContent = '';
          this.classList.remove('placeholder-active');
        }
      });

      el.addEventListener('blur', function () {
        updatePlaceholderState();
      });
    });
});

export {};
