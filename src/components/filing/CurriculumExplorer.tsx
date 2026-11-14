import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { CurriculumFolder, CurriculumWorkspace, LessonSequence } from '../../types/curriculum';

interface CurriculumExplorerProps {
  workspace: CurriculumWorkspace;
  activeSequenceId: string | null;
  activeLessonId: string | null;
  localFolderConnected: string | null;
  onSelectSequence: (sequenceId: string) => void;
  onSelectLesson: (sequenceId: string, lessonId: string) => void;
  onCreateFolder: (folder: Omit<CurriculumFolder, 'id' | 'createdAt'>) => void;
  onCreateNewSequence: (folderId: string) => void;
  onDeleteSequence: (sequenceId: string) => void;
  onConnectLocalFolder: () => void;
  onExportZip: () => void;
  onImportArchive: (file: File) => void;
}

export const CurriculumExplorer: React.FC<CurriculumExplorerProps> = ({
  workspace,
  activeSequenceId,
  activeLessonId,
  localFolderConnected,
  onSelectSequence,
  onSelectLesson,
  onCreateFolder,
  onCreateNewSequence,
  onDeleteSequence,
  onConnectLocalFolder,
  onExportZip,
  onImportArchive,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    workspace.folders.forEach((f) => {
      initial[f.id] = true;
    });
    return initial;
  });

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderKS, setNewFolderKS] = useState('KS3 (Year 8)');
  const [newFolderSubject, setNewFolderSubject] = useState('Computing');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder({
      name: newFolderName.trim(),
      keyStage: newFolderKS,
      subject: newFolderSubject,
      color: '#059669',
    });
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const getSequenceStageBadge = (seq: LessonSequence) => {
    if (seq.lessons.some((l) => l.slidesData.length > 0)) return 'Stage 4 Ready';
    if (seq.stage2Approved) return 'Stage 3';
    if (seq.stage1Approved) return 'Stage 2';
    return 'Stage 1';
  };

  return (
    <aside className="w-72 shrink-0 border-r border-zinc-200/80 bg-[#FAF6F0] flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200/80 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Curriculum Filing
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {workspace.sequences.length} sequences stored on-device
          </p>
        </div>
        <button
          onClick={() => setShowNewFolder((v) => !v)}
          title="New Curriculum Folder"
          className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition"
        >
          <FolderPlus size={16} />
        </button>
      </div>

      {/* Add Folder Inline Form */}
      {showNewFolder && (
        <form
          onSubmit={handleAddFolder}
          className="p-3 bg-white border-b border-zinc-200 space-y-2 text-xs"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name (e.g. Year 9 Algorithms)"
            className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={newFolderKS}
              onChange={(e) => setNewFolderKS(e.target.value)}
              placeholder="Key Stage"
              className="px-2 py-1 rounded-lg border border-zinc-300"
            />
            <input
              type="text"
              value={newFolderSubject}
              onChange={(e) => setNewFolderSubject(e.target.value)}
              placeholder="Subject"
              className="px-2 py-1 rounded-lg border border-zinc-300"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowNewFolder(false)}
              className="px-2 py-1 rounded-md text-zinc-500 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
            >
              Create Folder
            </button>
          </div>
        </form>
      )}

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {workspace.folders.map((folder) => {
          const isExpanded = expandedFolders[folder.id] ?? true;
          const folderSequences = workspace.sequences.filter(
            (s) => s.folderId === folder.id
          );

          return (
            <div key={folder.id} className="space-y-1">
              <div className="group flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-zinc-200/50 transition">
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  {isExpanded ? (
                    <FolderOpen size={15} style={{ color: folder.color }} className="shrink-0" />
                  ) : (
                    <Folder size={15} style={{ color: folder.color }} className="shrink-0" />
                  )}
                  <div className="truncate">
                    <span className="text-xs font-bold text-zinc-800 block truncate">
                      {folder.name}
                    </span>
                    <span className="text-[10px] text-zinc-500 block">
                      {folder.keyStage} • {folder.subject}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => onCreateNewSequence(folder.id)}
                  title="New Lesson Sequence in this folder"
                  className="opacity-70 group-hover:opacity-100 p-1 rounded-md hover:bg-white text-emerald-700 transition"
                >
                  <Plus size={14} />
                </button>
              </div>

              {isExpanded && (
                <div className="pl-3 space-y-1 border-l-2 border-zinc-200 ml-3">
                  {folderSequences.length === 0 && (
                    <button
                      onClick={() => onCreateNewSequence(folder.id)}
                      className="w-full text-left px-2.5 py-1.5 text-[11px] text-zinc-500 hover:text-emerald-700 italic"
                    >
                      + Plan first lesson sequence...
                    </button>
                  )}

                  {folderSequences.map((seq) => {
                    const isSeqActive = seq.id === activeSequenceId;
                    return (
                      <div key={seq.id} className="space-y-1">
                        <div
                          className={`group flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer transition ${
                            isSeqActive
                              ? 'bg-white shadow-xs border border-emerald-200 text-emerald-950'
                              : 'hover:bg-white/60 text-zinc-700'
                          }`}
                          onClick={() => onSelectSequence(seq.id)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">
                              {seq.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                                {getSequenceStageBadge(seq)}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                {seq.lessons.length || seq.lessonCount} lessons
                              </span>
                            </div>
                          </div>
                          {workspace.sequences.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSequence(seq.id);
                              }}
                              title="Delete sequence"
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:text-rose-600 transition"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>

                        {/* Individual Lessons under active sequence */}
                        {isSeqActive && seq.lessons.length > 0 && (
                          <div className="pl-2 space-y-0.5">
                            {seq.lessons.map((lesson) => {
                              const isLessonActive = lesson.id === activeLessonId;
                              return (
                                <button
                                  key={lesson.id}
                                  onClick={() => onSelectLesson(seq.id, lesson.id)}
                                  className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-left transition ${
                                    isLessonActive
                                      ? 'bg-emerald-600 text-white font-semibold'
                                      : 'text-zinc-600 hover:bg-zinc-200/60'
                                  }`}
                                >
                                  <span className="font-mono text-[10px] opacity-80">
                                    L{lesson.lessonNumber}
                                  </span>
                                  <span className="truncate flex-1">{lesson.title}</span>
                                  {lesson.slidesData.length > 0 && (
                                    <CheckCircle2
                                      size={11}
                                      className={
                                        isLessonActive ? 'text-emerald-200' : 'text-emerald-600'
                                      }
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Sync & Backup Bar */}
      <div className="p-3 border-t border-zinc-200/80 bg-white/70 space-y-2">
        <button
          onClick={onConnectLocalFolder}
          className={`w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition ${
            localFolderConnected
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <HardDrive size={14} />
          <span className="truncate">
            {localFolderConnected
              ? `Synced: ${localFolderConnected}`
              : 'Sync to Local Folder'}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onExportZip}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition"
          >
            <Download size={13} />
            <span>Backup .spzip</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition"
          >
            <Upload size={13} />
            <span>Restore</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".spzip,.zip,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportArchive(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </aside>
  );
};
