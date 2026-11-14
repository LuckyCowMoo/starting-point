import { get, set } from 'idb-keyval';
import JSZip from 'jszip';
import {
  AppSettings,
  CurriculumWorkspace,
  LessonSequence,
} from '../types/curriculum';
import { DEMO_WORKSPACE } from '../data/demoCurriculum';

const WORKSPACE_DB_KEY = 'starting-point-workspace-v1';
const SETTINGS_LS_KEY = 'starting-point-settings-v1';

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-pro',
  pexelsApiKey: '',
  pixabayApiKey: '',
  googleClientId: '',
  showPedagogicalCallouts: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_LS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Could not save settings to localStorage:', err);
  }
}

export async function loadWorkspace(): Promise<CurriculumWorkspace> {
  try {
    const stored = await get<CurriculumWorkspace>(WORKSPACE_DB_KEY);
    if (stored && Array.isArray(stored.folders) && Array.isArray(stored.sequences)) {
      return stored;
    }
  } catch (err) {
    console.warn('IndexedDB unavailable, falling back to demo workspace:', err);
  }
  return DEMO_WORKSPACE;
}

export async function saveWorkspace(workspace: CurriculumWorkspace): Promise<void> {
  try {
    await set(WORKSPACE_DB_KEY, workspace);
  } catch (err) {
    console.warn('Failed to persist workspace to IndexedDB:', err);
  }
}

// --- Local Folder Sync via File System Access API ---

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
    id?: string;
  }) => Promise<FileSystemDirectoryHandle>;
}

export function isLocalFolderSyncSupported(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'item'
  );
}

export async function pickLocalSyncFolder(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) return null;
  try {
    return await picker({ mode: 'readwrite', id: 'starting-point-curriculum' });
  } catch {
    return null;
  }
}

export async function syncWorkspaceToLocalFolder(
  dirHandle: FileSystemDirectoryHandle,
  workspace: CurriculumWorkspace
): Promise<{ filesWritten: number }> {
  let filesWritten = 0;

  // Write top-level manifest
  const manifestHandle = await dirHandle.getFileHandle('starting-point-manifest.json', {
    create: true,
  });
  const manifestWritable = await manifestHandle.createWritable();
  await manifestWritable.write(
    JSON.stringify(
      {
        app: 'Starting Point',
        exportedAt: new Date().toISOString(),
        folders: workspace.folders,
      },
      null,
      2
    )
  );
  await manifestWritable.close();
  filesWritten++;

  // Write folders and sequence JSON files
  for (const folder of workspace.folders) {
    const folderDir = await dirHandle.getDirectoryHandle(slugify(folder.name), {
      create: true,
    });
    const folderSequences = workspace.sequences.filter((s) => s.folderId === folder.id);

    for (const seq of folderSequences) {
      const seqFileName = `${slugify(seq.title)}.sequence.json`;
      const seqHandle = await folderDir.getFileHandle(seqFileName, { create: true });
      const seqWritable = await seqHandle.createWritable();
      await seqWritable.write(JSON.stringify(seq, null, 2));
      await seqWritable.close();
      filesWritten++;
    }
  }

  return { filesWritten };
}

export async function loadWorkspaceFromLocalFolder(
  dirHandle: FileSystemDirectoryHandle
): Promise<CurriculumWorkspace | null> {
  try {
    const manifestHandle = await dirHandle.getFileHandle('starting-point-manifest.json');
    const manifestFile = await manifestHandle.getFile();
    const manifest = JSON.parse(await manifestFile.text());
    if (!Array.isArray(manifest.folders)) return null;

    const sequences: LessonSequence[] = [];
    for (const folder of manifest.folders) {
      try {
        const folderDir = await dirHandle.getDirectoryHandle(slugify(folder.name));
        // @ts-expect-error values() async iterator on FileSystemDirectoryHandle
        for await (const entry of folderDir.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.sequence.json')) {
            const file = await entry.getFile();
            const parsed = JSON.parse(await file.text()) as LessonSequence;
            sequences.push(parsed);
          }
        }
      } catch {
        // Folder might have no sequences yet
      }
    }

    return {
      folders: manifest.folders,
      sequences,
    };
  } catch {
    return null;
  }
}

// --- Portable ZIP Archive (.spzip) Export / Import ---

export async function exportWorkspaceToZip(workspace: CurriculumWorkspace): Promise<void> {
  const zip = new JSZip();
  zip.file(
    'starting-point-manifest.json',
    JSON.stringify(
      {
        app: 'Starting Point',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        folders: workspace.folders,
      },
      null,
      2
    )
  );

  for (const folder of workspace.folders) {
    const folderZip = zip.folder(slugify(folder.name));
    const folderSeqs = workspace.sequences.filter((s) => s.folderId === folder.id);
    for (const seq of folderSeqs) {
      folderZip?.file(`${slugify(seq.title)}.sequence.json`, JSON.stringify(seq, null, 2));
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `starting-point-curriculum-${new Date().toISOString().slice(0, 10)}.spzip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importWorkspaceFromFile(file: File): Promise<CurriculumWorkspace> {
  if (file.name.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.folders) && Array.isArray(parsed.sequences)) {
      return parsed as CurriculumWorkspace;
    }
    if (parsed.id && parsed.objectives && Array.isArray(parsed.lessons)) {
      // Single sequence JSON import
      const single = parsed as LessonSequence;
      return {
        folders: [
          {
            id: single.folderId || 'imported-folder',
            name: `${single.keyStage || 'Imported'} ${single.subject || 'Subject'}`,
            keyStage: single.keyStage || 'Secondary',
            subject: single.subject || 'General',
            color: '#059669',
            createdAt: new Date().toISOString(),
          },
        ],
        sequences: [single],
      };
    }
    throw new Error('Unrecognised JSON curriculum format.');
  }

  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('starting-point-manifest.json');
  if (!manifestFile) {
    throw new Error('Missing starting-point-manifest.json inside archive.');
  }
  const manifest = JSON.parse(await manifestFile.async('text'));
  const sequences: LessonSequence[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (!entry.dir && path.endsWith('.sequence.json')) {
      const content = await entry.async('text');
      sequences.push(JSON.parse(content) as LessonSequence);
    }
  }

  return {
    folders: manifest.folders || [],
    sequences,
  };
}
