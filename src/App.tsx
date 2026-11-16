import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  KeyRound,
  Layers,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  Trash2,
} from 'lucide-react';
import {
  AppSettings,
  CurriculumFolder,
  CurriculumWorkspace,
  LessonSequence,
  PlannedLesson,
  StageId,
} from './types/curriculum';
import { DEMO_WORKSPACE } from './data/demoCurriculum';
import {
  exportWorkspaceToZip,
  importWorkspaceFromFile,
  isLocalFolderSyncSupported,
  loadSettings,
  loadWorkspace,
  loadWorkspaceFromLocalFolder,
  pickLocalSyncFolder,
  saveSettings,
  saveWorkspace,
  syncWorkspaceToLocalFolder,
} from './services/fileSystemStore';
import { CurriculumExplorer } from './components/filing/CurriculumExplorer';
import { Stage1ObjectivesView } from './components/stages/Stage1ObjectivesView';
import { Stage2SequenceView } from './components/stages/Stage2SequenceView';
import { Stage3BlueprintView } from './components/stages/Stage3BlueprintView';
import { Stage4SlideStudio } from './components/stages/Stage4SlideStudio';
import { ClassroomPresenter } from './components/presenter/ClassroomPresenter';
import { ExportModal } from './components/export/ExportModal';
import { ShareLessonModal } from './components/export/ShareLessonModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { parseLessonLink, syncUrlHash } from './utils/urlRouter';

export function App() {
  const [workspace, setWorkspace] = useState<CurriculumWorkspace>(DEMO_WORKSPACE);
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  const [activeSequenceId, setActiveSequenceId] = useState<string | null>(
    DEMO_WORKSPACE.sequences[0].id
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(
    DEMO_WORKSPACE.sequences[0].lessons[0]?.id || null
  );
  const [activeStage, setActiveStage] = useState<StageId>(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [presentingState, setPresentingState] = useState<{
    lessonId: string;
    slideIdx: number;
  } | null>(null);
  const [exportLessonId, setExportLessonId] = useState<string | null>(null);
  const [shareModalLesson, setShareModalLesson] = useState<PlannedLesson | null>(null);
  const [urlSlideIdx, setUrlSlideIdx] = useState<number | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmResetModalOpen, setConfirmResetModalOpen] = useState(false);

  const localDirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const initApp = async () => {
      let activeWs = await loadWorkspace();
      let restoredSeqId: string | null = null;
      let restoredLessonId: string | null = null;
      let restoredStage: StageId | null = null;

      // 1. Check for incoming URL deep-link or portable payload first (#lesson=... or #data=... or #load=...)
      const link = parseLessonLink();

      // Check for remote load URL
      if (link.loadUrl) {
        try {
          const res = await fetch(link.loadUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.title && Array.isArray(data.slidesData)) {
              const remoteLesson = data as PlannedLesson;
              const targetSeq = activeWs.sequences[0];
              if (targetSeq) {
                const exists = targetSeq.lessons.some((l) => l.id === remoteLesson.id);
                const updatedLessons = exists
                  ? targetSeq.lessons.map((l) => (l.id === remoteLesson.id ? remoteLesson : l))
                  : [remoteLesson, ...targetSeq.lessons];
                activeWs = {
                  ...activeWs,
                  sequences: activeWs.sequences.map((s) =>
                    s.id === targetSeq.id ? { ...s, lessons: updatedLessons } : s
                  ),
                };
                restoredSeqId = targetSeq.id;
                restoredLessonId = remoteLesson.id;
                restoredStage = 4;
                showToast(`Loaded remote lesson: "${remoteLesson.title}"`);
              }
            } else if (data.folders && data.sequences) {
              activeWs = data as CurriculumWorkspace;
              restoredSeqId = activeWs.sequences[0]?.id || null;
              restoredLessonId = activeWs.sequences[0]?.lessons[0]?.id || null;
              restoredStage = 4;
              showToast('Loaded remote workspace!');
            }
          }
        } catch (err) {
          console.warn('Failed to load remote URL:', err);
        }
      } else if (link.loadTomorrow) {
        // Automatically fetch tomorrow's lesson from public lessons
        try {
          const res = await fetch('lessons/tomorrow.json');
          if (res.ok) {
            const data = await res.json();
            if (data.title && Array.isArray(data.slidesData)) {
              const tomorrowLesson = data as PlannedLesson;
              const targetSeq = activeWs.sequences[0];
              if (targetSeq) {
                const exists = targetSeq.lessons.some((l) => l.id === tomorrowLesson.id);
                const updatedLessons = exists
                  ? targetSeq.lessons.map((l) => (l.id === tomorrowLesson.id ? tomorrowLesson : l))
                  : [tomorrowLesson, ...targetSeq.lessons];
                activeWs = {
                  ...activeWs,
                  sequences: activeWs.sequences.map((s) =>
                    s.id === targetSeq.id ? { ...s, lessons: updatedLessons } : s
                  ),
                };
                restoredSeqId = targetSeq.id;
                restoredLessonId = tomorrowLesson.id;
                restoredStage = 4;
                showToast(`Loaded lesson: "${tomorrowLesson.title}"`);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to load tomorrow.json:', err);
        }
      }

      if (link.portableLesson && !restoredLessonId) {
        // Import or merge portable lesson into the primary sequence
        const existingSeq = activeWs.sequences[0];
        if (existingSeq) {
          const exists = existingSeq.lessons.some((l) => l.id === link.portableLesson!.id);
          const updatedLessons = exists
            ? existingSeq.lessons.map((l) => (l.id === link.portableLesson!.id ? link.portableLesson! : l))
            : [link.portableLesson, ...existingSeq.lessons];
          activeWs = {
            ...activeWs,
            sequences: activeWs.sequences.map((s) =>
              s.id === existingSeq.id ? { ...s, lessons: updatedLessons } : s
            ),
          };
          restoredSeqId = existingSeq.id;
          restoredLessonId = link.portableLesson.id;
          restoredStage = 4;
          if (link.slideIndex !== undefined) setUrlSlideIdx(link.slideIndex);
          showToast(`Opened shared lesson: "${link.portableLesson.title}"`);
        }
      } else if ((link.lessonId || link.lessonNumber !== undefined) && !restoredLessonId) {
        // Find matching sequence and lesson
        for (const seq of activeWs.sequences) {
          const found = seq.lessons.find(
            (l) =>
              (link.lessonId && l.id === link.lessonId) ||
              (link.lessonNumber !== undefined && l.lessonNumber === link.lessonNumber) ||
              (link.lessonId &&
                l.title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .includes(link.lessonId.toLowerCase()))
          );
          if (found) {
            restoredSeqId = seq.id;
            restoredLessonId = found.id;
            restoredStage = (link.stage as StageId) || 4;
            if (link.slideIndex !== undefined) setUrlSlideIdx(link.slideIndex);
            if (link.present) {
              setPresentingState({ lessonId: found.id, slideIdx: link.slideIndex || 0 });
            }
            break;
          }
        }

        // If not found in local workspace, check bundled DEMO_WORKSPACE
        if (!restoredLessonId) {
          for (const demoSeq of DEMO_WORKSPACE.sequences) {
            const foundDemo = demoSeq.lessons.find(
              (l) =>
                (link.lessonId && l.id === link.lessonId) ||
                (link.lessonNumber !== undefined && l.lessonNumber === link.lessonNumber) ||
                (link.lessonId &&
                  l.title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .includes(link.lessonId.toLowerCase()))
            );
            if (foundDemo) {
              const targetSeq =
                activeWs.sequences.find((s) => s.id === demoSeq.id) ||
                activeWs.sequences[0];
              if (targetSeq) {
                const exists = targetSeq.lessons.some((l) => l.id === foundDemo.id);
                const updatedLessons = exists
                  ? targetSeq.lessons.map((l) => (l.id === foundDemo.id ? foundDemo : l))
                  : [...targetSeq.lessons, foundDemo];
                activeWs = {
                  ...activeWs,
                  sequences: activeWs.sequences.map((s) =>
                    s.id === targetSeq.id ? { ...s, lessons: updatedLessons } : s
                  ),
                };
                restoredSeqId = targetSeq.id;
                restoredLessonId = foundDemo.id;
                restoredStage = (link.stage as StageId) || 4;
                if (link.slideIndex !== undefined) setUrlSlideIdx(link.slideIndex);
                if (link.present) {
                  setPresentingState({ lessonId: foundDemo.id, slideIdx: link.slideIndex || 0 });
                }
                break;
              }
            }
          }
        }

        // If still not found, check public/lessons/tomorrow.json
        if (!restoredLessonId) {
          try {
            const res = await fetch('lessons/tomorrow.json');
            if (res.ok) {
              const data = await res.json();
              if (data.title && Array.isArray(data.slidesData)) {
                const tomorrowLesson = data as PlannedLesson;
                const targetSeq = activeWs.sequences[0];
                if (targetSeq) {
                  const exists = targetSeq.lessons.some((l) => l.id === tomorrowLesson.id);
                  const updatedLessons = exists
                    ? targetSeq.lessons.map((l) => (l.id === tomorrowLesson.id ? tomorrowLesson : l))
                    : [...targetSeq.lessons, tomorrowLesson];
                  activeWs = {
                    ...activeWs,
                    sequences: activeWs.sequences.map((s) =>
                      s.id === targetSeq.id ? { ...s, lessons: updatedLessons } : s
                    ),
                  };
                  restoredSeqId = targetSeq.id;
                  restoredLessonId = tomorrowLesson.id;
                  restoredStage = (link.stage as StageId) || 4;
                  if (link.slideIndex !== undefined) setUrlSlideIdx(link.slideIndex);
                  if (link.present) {
                    setPresentingState({
                      lessonId: tomorrowLesson.id,
                      slideIdx: link.slideIndex || 0,
                    });
                  }
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }

      setWorkspace(activeWs);

      // 2. Fall back to localStorage navigation if not deep-linked via URL
      if (!restoredLessonId) {
        try {
          const rawNav = localStorage.getItem('starting-point-active-nav-v1');
          if (rawNav) {
            const parsed = JSON.parse(rawNav) as {
              activeSequenceId?: string | null;
              activeLessonId?: string | null;
              activeStage?: StageId;
            };
            restoredSeqId = parsed.activeSequenceId ?? null;
            restoredLessonId = parsed.activeLessonId ?? null;
            if (
              parsed.activeStage === 1 ||
              parsed.activeStage === 2 ||
              parsed.activeStage === 3 ||
              parsed.activeStage === 4
            ) {
              restoredStage = parsed.activeStage;
            }
          }
        } catch {
          // ignore storage errors
        }
      }

      const targetSeq =
        activeWs.sequences.find((s) => s.id === restoredSeqId) ||
        activeWs.sequences[0];
      if (targetSeq) {
        setActiveSequenceId(targetSeq.id);
        const targetLesson =
          targetSeq.lessons.find((l) => l.id === restoredLessonId) ||
          targetSeq.lessons[0];
        setActiveLessonId(targetLesson?.id || null);
      }
      if (restoredStage) {
        setActiveStage(restoredStage);
      }
      setHydrated(true);
    };
    void initApp();
  }, []);

  // Listen to browser hash changes (e.g. user pastes new #lesson=... link or hits back/forward)
  useEffect(() => {
    if (!hydrated) return;
    const handleHashChange = () => {
      const link = parseLessonLink();
      if (!link.lessonId && link.lessonNumber === undefined && !link.portableLesson) return;

      for (const seq of workspace.sequences) {
        const found = seq.lessons.find(
          (l) =>
            (link.lessonId && l.id === link.lessonId) ||
            (link.lessonNumber !== undefined && l.lessonNumber === link.lessonNumber) ||
            (link.lessonId && l.id.endsWith(link.lessonId)) ||
            (link.lessonId && link.lessonId.endsWith(l.id)) ||
            (link.lessonId &&
              l.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .includes(link.lessonId.toLowerCase()))
        );
        if (found) {
          setActiveSequenceId(seq.id);
          setActiveLessonId(found.id);
          if (link.stage) setActiveStage(link.stage as StageId);
          if (link.slideIndex !== undefined) setUrlSlideIdx(link.slideIndex);
          return;
        }
      }

      // If not found in current workspace, check DEMO_WORKSPACE
      for (const demoSeq of DEMO_WORKSPACE.sequences) {
        const foundDemo = demoSeq.lessons.find(
          (l) =>
            (link.lessonId && l.id === link.lessonId) ||
            (link.lessonNumber !== undefined && l.lessonNumber === link.lessonNumber) ||
            (link.lessonId &&
              l.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .includes(link.lessonId.toLowerCase()))
        );
        if (foundDemo) {
          const targetSeq =
            workspace.sequences.find((s) => s.id === demoSeq.id) ||
            workspace.sequences[0];
          if (targetSeq) {
            const exists = targetSeq.lessons.some((l) => l.id === foundDemo.id);
            const updatedLessons = exists
              ? targetSeq.lessons.map((l) => (l.id === foundDemo.id ? foundDemo : l))
              : [...targetSeq.lessons, foundDemo];
            setWorkspace({
              ...workspace,
              sequences: workspace.sequences.map((s) =>
                s.id === targetSeq.id ? { ...s, lessons: updatedLessons } : s
              ),
            });
            setActiveSequenceId(targetSeq.id);
            setActiveLessonId(foundDemo.id);
            setActiveStage((link.stage as StageId) || 4);
            if (link.slideIndex !== undefined) setUrlSlideIdx(link.slideIndex);
            return;
          }
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [workspace, hydrated]);

  // Keep browser address bar in sync with current lesson & stage so copying the URL works anytime
  useEffect(() => {
    if (!hydrated) return;
    syncUrlHash(activeLessonId, activeStage, urlSlideIdx);
  }, [activeLessonId, activeStage, urlSlideIdx, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        'starting-point-active-nav-v1',
        JSON.stringify({ activeSequenceId, activeLessonId, activeStage })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [activeSequenceId, activeLessonId, activeStage, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void saveWorkspace(workspace);
    if (localDirHandleRef.current) {
      void syncWorkspaceToLocalFolder(localDirHandleRef.current, workspace);
    }
  }, [workspace, hydrated]);

  const handleUpdateSettings = (next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const activeSequence =
    workspace.sequences.find((s) => s.id === activeSequenceId) ||
    workspace.sequences[0];

  const updateSequence = (updated: LessonSequence) => {
    setWorkspace((prev) => ({
      ...prev,
      sequences: prev.sequences.map((s) =>
        s.id === updated.id ? updated : s
      ),
    }));
  };

  const handleCreateFolder = (
    folder: Omit<CurriculumFolder, 'id' | 'createdAt'>
  ) => {
    const newFolder: CurriculumFolder = {
      ...folder,
      id: `folder-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setWorkspace((prev) => ({
      ...prev,
      folders: [...prev.folders, newFolder],
    }));
    showToast(`Folder "${newFolder.name}" created.`);
  };

  const handleCreateNewSequence = (folderId: string) => {
    const folder = workspace.folders.find((f) => f.id === folderId);
    const newSeq: LessonSequence = {
      id: `seq-${Date.now()}`,
      folderId,
      title: 'Untitled Lesson Sequence',
      subject: folder?.subject || 'Computing',
      keyStage: folder?.keyStage || 'KS3 (Year 8)',
      lessonCount: 4,
      defaultLessonMinutes: 60,
      priorUnitSummary: '',
      topicBrief: '',
      updatedAt: new Date().toISOString(),
      stage1Approved: false,
      stage2Approved: false,
      objectives: {
        know: [],
        do: [],
        understand: [],
        keyVocabulary: [],
        misconceptions: [],
        prerequisiteKnowledge: [],
        pedagogicalSummary: '',
      },
      lessons: [],
    };
    setWorkspace((prev) => ({
      ...prev,
      sequences: [...prev.sequences, newSeq],
    }));
    setActiveSequenceId(newSeq.id);
    setActiveLessonId(null);
    setActiveStage(1);
    showToast('New sequence created in Stage 1.');
  };

  const handleDeleteSequence = (sequenceId: string) => {
    setWorkspace((prev) => {
      const remaining = prev.sequences.filter((s) => s.id !== sequenceId);
      if (remaining.length === 0) {
        const freshSeq: LessonSequence = {
          id: `seq-${Date.now()}`,
          folderId: 'folder-root',
          title: 'Untitled Lesson Sequence',
          subject: 'Computing',
          keyStage: 'KS3 (Year 8)',
          lessonCount: 4,
          defaultLessonMinutes: 60,
          priorUnitSummary: '',
          topicBrief: '',
          updatedAt: new Date().toISOString(),
          stage1Approved: false,
          stage2Approved: false,
          objectives: {
            know: [],
            do: [],
            understand: [],
            keyVocabulary: [],
            misconceptions: [],
            prerequisiteKnowledge: [],
            pedagogicalSummary: '',
          },
          lessons: [],
        };
        setActiveSequenceId(freshSeq.id);
        setActiveLessonId(null);
        setActiveStage(1);
        return { ...prev, sequences: [freshSeq] };
      }
      if (activeSequenceId === sequenceId && remaining[0]) {
        setActiveSequenceId(remaining[0].id);
        setActiveLessonId(remaining[0].lessons[0]?.id || null);
      }
      return { ...prev, sequences: remaining };
    });
  };

  const handleStartAgain = () => {
    if (!activeSequence) return;
    const seqIdToDelete = activeSequence.id;
    if (workspace.sequences.length <= 1) {
      const freshSeq: LessonSequence = {
        id: `seq-${Date.now()}`,
        folderId: activeSequence.folderId,
        title: 'Untitled Lesson Sequence',
        subject: activeSequence.subject || 'Computing',
        keyStage: activeSequence.keyStage || 'KS3 (Year 8)',
        lessonCount: 4,
        defaultLessonMinutes: 60,
        priorUnitSummary: '',
        topicBrief: '',
        updatedAt: new Date().toISOString(),
        stage1Approved: false,
        stage2Approved: false,
        objectives: {
          know: [],
          do: [],
          understand: [],
          keyVocabulary: [],
          misconceptions: [],
          prerequisiteKnowledge: [],
          pedagogicalSummary: '',
        },
        lessons: [],
      };
      setWorkspace((prev) => ({
        ...prev,
        sequences: [freshSeq],
      }));
      setActiveSequenceId(freshSeq.id);
      setActiveLessonId(null);
      setActiveStage(1);
    } else {
      handleDeleteSequence(seqIdToDelete);
      setActiveStage(1);
    }
    setConfirmResetModalOpen(false);
    showToast('Lesson plan reset. Ready to start fresh in Stage 1.');
  };

  const handleConnectLocalFolder = async () => {
    if (!isLocalFolderSyncSupported()) {
      showToast(
        'Local Folder Sync requires Chrome or Edge. Use Backup .spzip in this browser!'
      );
      return;
    }
    const handle = await pickLocalSyncFolder();
    if (!handle) return;
    localDirHandleRef.current = handle;
    setLocalFolderName(handle.name);

    const existing = await loadWorkspaceFromLocalFolder(handle);
    if (existing && existing.sequences.length > 0) {
      setWorkspace(existing);
      setActiveSequenceId(existing.sequences[0].id);
      setActiveLessonId(existing.sequences[0].lessons[0]?.id || null);
      showToast(`Loaded curriculum from folder "${handle.name}"!`);
    } else {
      const res = await syncWorkspaceToLocalFolder(handle, workspace);
      showToast(`Synced ${res.filesWritten} files to "${handle.name}"!`);
    }
  };

  const handleImportArchive = async (file: File) => {
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed.title && Array.isArray(parsed.slidesData)) {
          const singleLesson = parsed as PlannedLesson;
          const currentSeq =
            workspace.sequences.find((s) => s.id === activeSequenceId) ||
            workspace.sequences[0];
          if (currentSeq) {
            const exists = currentSeq.lessons.some((l) => l.id === singleLesson.id);
            const updatedLessons = exists
              ? currentSeq.lessons.map((l) => (l.id === singleLesson.id ? singleLesson : l))
              : [...currentSeq.lessons, singleLesson];
            const updatedWs: CurriculumWorkspace = {
              ...workspace,
              sequences: workspace.sequences.map((s) =>
                s.id === currentSeq.id ? { ...s, lessons: updatedLessons } : s
              ),
            };
            setWorkspace(updatedWs);
            setActiveSequenceId(currentSeq.id);
            setActiveLessonId(singleLesson.id);
            setActiveStage(4);
            showToast(`Loaded lesson "${singleLesson.title}"!`);
            return;
          }
        }
      }
      const imported = await importWorkspaceFromFile(file);
      setWorkspace(imported);
      if (imported.sequences[0]) {
        setActiveSequenceId(imported.sequences[0].id);
        setActiveLessonId(imported.sequences[0].lessons[0]?.id || null);
      }
      showToast(`Imported ${imported.sequences.length} sequence(s)!`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const stage2Unlocked = activeSequence?.stage1Approved ?? false;
  const stage3Unlocked =
    (activeSequence?.stage2Approved ?? false) &&
    (activeSequence?.lessons.length ?? 0) > 0;
  const stage4Unlocked =
    activeSequence?.lessons.some((l) => l.slidesData.length > 0) ?? false;

  const navigateToStage = (stage: StageId) => {
    setActiveStage(stage);
    // Auto-collapse outer curriculum sidebar in Stage 4 so the 16:9 Slide Canvas gets generous screen space
    if (stage === 4) {
      setSidebarOpen(false);
    }
  };

  const stageItems: {
    id: StageId;
    label: string;
    unlocked: boolean;
    done: boolean;
  }[] = [
    {
      id: 1,
      label: '1. Objectives',
      unlocked: true,
      done: activeSequence?.stage1Approved ?? false,
    },
    {
      id: 2,
      label: '2. Sequence',
      unlocked: stage2Unlocked,
      done: activeSequence?.stage2Approved ?? false,
    },
    {
      id: 3,
      label: '3. Blueprint',
      unlocked: stage3Unlocked,
      done: stage4Unlocked,
    },
    {
      id: 4,
      label: '4. Slide Studio',
      unlocked: stage4Unlocked,
      done: false,
    },
  ];

  const presentingLesson =
    presentingState &&
    activeSequence?.lessons.find((l) => l.id === presentingState.lessonId);
  const exportLesson =
    exportLessonId &&
    activeSequence?.lessons.find((l) => l.id === exportLessonId);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#F6F3ED] text-zinc-900 overflow-hidden">
      {/* Top Studio Header */}
      <header className="h-16 shrink-0 border-b border-zinc-200/80 bg-white px-4 flex items-center justify-between gap-4 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-2 rounded-xl text-zinc-600 hover:bg-zinc-100"
            title="Toggle Curriculum Filing Sidebar"
          >
            {sidebarOpen ? (
              <PanelLeftClose size={18} />
            ) : (
              <PanelLeftOpen size={18} />
            )}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-900 flex items-center justify-center text-white shadow-sm">
              <Layers size={18} />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-base leading-none tracking-tight text-zinc-900">
                Starting Point
              </h1>
              <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                Pedagogical Sequence & Slide Studio
              </p>
            </div>
          </div>
        </div>

        {/* 4-Stage Gated Progress Stepper */}
        <nav className="hidden md:flex items-center gap-1.5 bg-[#FAF6F0] p-1 rounded-2xl border border-zinc-200">
          {stageItems.map((st) => {
            const isActive = activeStage === st.id;
            return (
              <button
                key={st.id}
                onClick={() => st.unlocked && navigateToStage(st.id)}
                disabled={!st.unlocked}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : st.unlocked
                    ? 'text-zinc-700 hover:bg-white'
                    : 'text-zinc-400 cursor-not-allowed'
                }`}
              >
                {!st.unlocked ? (
                  <Lock size={12} />
                ) : st.done ? (
                  <Check size={12} className={isActive ? 'text-emerald-300' : 'text-emerald-600'} />
                ) : null}
                <span>{st.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Actions: Start Again / Delete Plan + Settings */}
        <div className="flex items-center gap-2">
          {activeSequence && (
            <button
              onClick={() => setConfirmResetModalOpen(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-zinc-200 text-zinc-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 flex items-center gap-1.5 transition"
              title="Delete this lesson plan and start again"
            >
              <RotateCcw size={13} className="text-zinc-500 hover:text-rose-600" />
              <span className="hidden sm:inline">Start Again</span>
            </button>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition ${
              settings.geminiApiKey.trim()
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <KeyRound size={14} />
            <span className="hidden sm:inline">
              {settings.geminiApiKey.trim() ? 'Gemini Ready' : 'Add Gemini Key'}
            </span>
            <Settings size={14} className="opacity-70" />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <CurriculumExplorer
            workspace={workspace}
            activeSequenceId={activeSequence?.id || null}
            activeLessonId={activeLessonId}
            localFolderConnected={localFolderName}
            onSelectSequence={(seqId) => {
              setActiveSequenceId(seqId);
              const seq = workspace.sequences.find((s) => s.id === seqId);
              setActiveLessonId(seq?.lessons[0]?.id || null);
              if (seq && !seq.stage1Approved) setActiveStage(1);
              else if (seq && !seq.stage2Approved) setActiveStage(2);
            }}
            onSelectLesson={(seqId, lessonId) => {
              setActiveSequenceId(seqId);
              setActiveLessonId(lessonId);
              const seq = workspace.sequences.find((s) => s.id === seqId);
              const lesson = seq?.lessons.find((l) => l.id === lessonId);
              if (lesson && lesson.slidesData.length > 0) {
                navigateToStage(4);
              } else if (seq?.stage2Approved) {
                navigateToStage(3);
              }
            }}
            onCreateFolder={handleCreateFolder}
            onCreateNewSequence={handleCreateNewSequence}
            onDeleteSequence={handleDeleteSequence}
            onConnectLocalFolder={() => void handleConnectLocalFolder()}
            onExportZip={() => void exportWorkspaceToZip(workspace)}
            onImportArchive={(f) => void handleImportArchive(f)}
          />
        )}

        <main className="flex-1 overflow-y-auto">
          {activeSequence && activeStage === 1 && (
            <Stage1ObjectivesView
              sequence={activeSequence}
              settings={settings}
              onUpdateSequence={updateSequence}
              onApproveAndProceed={() => {
                updateSequence({ ...activeSequence, stage1Approved: true });
                setActiveStage(2);
              }}
            />
          )}

          {activeSequence && activeStage === 2 && (
            <Stage2SequenceView
              sequence={activeSequence}
              settings={settings}
              onUpdateSequence={updateSequence}
              onOpenLessonStage3={(lessonId) => {
                updateSequence({ ...activeSequence, stage2Approved: true });
                setActiveLessonId(lessonId);
                setActiveStage(3);
              }}
              onApproveAndProceed={() => {
                updateSequence({ ...activeSequence, stage2Approved: true });
                setActiveLessonId(activeSequence.lessons[0]?.id || null);
                setActiveStage(3);
              }}
            />
          )}

          {activeSequence && activeStage === 3 && (
            <Stage3BlueprintView
              sequence={activeSequence}
              activeLessonId={activeLessonId}
              settings={settings}
              onSelectLesson={setActiveLessonId}
              onUpdateSequence={updateSequence}
              onOpenStage4Studio={(lessonId) => {
                setActiveLessonId(lessonId);
                navigateToStage(4);
              }}
            />
          )}

          {activeSequence && activeStage === 4 && (
            <Stage4SlideStudio
              sequence={activeSequence}
              activeLessonId={activeLessonId}
              settings={settings}
              initialSlideIndex={urlSlideIdx}
              onSelectLesson={setActiveLessonId}
              onUpdateSequence={updateSequence}
              onLaunchPresenter={(lessonId, slideIdx) =>
                setPresentingState({ lessonId, slideIdx })
              }
              onOpenExportModal={(lessonId) => setExportLessonId(lessonId)}
            />
          )}
        </main>
      </div>

      {/* Classroom Live Presenter */}
      {presentingLesson && presentingState && (
        <ClassroomPresenter
          lesson={presentingLesson}
          initialSlideIndex={presentingState.slideIdx}
          onExit={() => setPresentingState(null)}
        />
      )}

      {/* Export Modal (.pptx, Images & Google Slides) */}
      <ExportModal
        isOpen={Boolean(exportLesson)}
        lesson={exportLesson || null}
        settings={settings}
        currentSlideIndex={urlSlideIdx ?? 0}
        onUpdateGoogleClientId={(cid) =>
          handleUpdateSettings({ ...settings, googleClientId: cid })
        }
        onOpenShareModal={() => setShareModalLesson(exportLesson || null)}
        onClose={() => setExportLessonId(null)}
      />

      {/* Share Lesson Direct Link Modal */}
      <ShareLessonModal
        isOpen={Boolean(shareModalLesson)}
        lesson={shareModalLesson}
        currentSlideIndex={urlSlideIdx ?? 0}
        onClose={() => setShareModalLesson(null)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResetDemoWorkspace={() => {
          setWorkspace(DEMO_WORKSPACE);
          setActiveSequenceId(DEMO_WORKSPACE.sequences[0].id);
          setActiveLessonId(DEMO_WORKSPACE.sequences[0].lessons[0].id);
          setActiveStage(1);
          showToast('Demo curriculum restored.');
        }}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Confirmation Modal to Start Again / Delete Lesson Plan */}
      {confirmResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-zinc-200 animate-reveal-pop">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-display font-extrabold text-zinc-900">
                Delete Lesson Plan & Start Again?
              </h3>
              <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-zinc-900">"{activeSequence?.title}"</strong>?
                This will clear its objectives, sequence progression, blueprints, and slides so you can begin fresh from Stage 1.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartAgain}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition"
              >
                Yes, Delete & Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtle Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold animate-reveal-pop">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
