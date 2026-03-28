import React, { useState, useEffect, useCallback } from 'react';
import { X, FolderOpen, FileText, FileImage, FileCode, Trash2, Download, Eye, RefreshCw } from 'lucide-react';
import { WorkspaceFileMetadata } from '../types';
import { workspaceService } from '../services/workspaceService';
import { AnimatedPanel } from './AnimatedUI';

interface WorkspacePanelProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  themePreset: 'default' | 'notion' | 'monet' | 'apple' | 'forsion1';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('python') || mimeType.includes('javascript') || mimeType.includes('json')) return FileCode;
  return FileText;
}

const WorkspacePanel: React.FC<WorkspacePanelProps> = ({ sessionId, isOpen, onClose, themePreset }) => {
  const [files, setFiles] = useState<WorkspaceFileMetadata[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');

  const isNotion = themePreset === 'notion';
  const isMonet = themePreset === 'monet';
  const isApple = themePreset === 'apple';
  const isForsion1 = themePreset === 'forsion1';

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const list = await workspaceService.listFiles(sessionId);
    setFiles(list.sort((a, b) => b.updatedAt - a.updatedAt));
  }, [sessionId]);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sessionId === sessionId) refresh();
    };
    window.addEventListener('workspace-changed', handler);
    return () => window.removeEventListener('workspace-changed', handler);
  }, [sessionId, refresh]);

  const handleDelete = async (path: string) => {
    await workspaceService.deleteFile(sessionId, path);
  };

  const handleDownload = async (path: string) => {
    const file = await workspaceService.readFile(sessionId, path);
    if (!file) return;
    const blob = new Blob([file.content], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() ?? path;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async (path: string, mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      const dataUrl = await workspaceService.readFileAsDataUrl(sessionId, path);
      if (dataUrl) { setPreviewUrl(dataUrl); setPreviewName(path); }
    } else {
      const text = await workspaceService.readTextFile(sessionId, path);
      if (text !== null) { setPreviewUrl(null); setPreviewName(`${path}\n\n${text.slice(0, 5000)}`); }
    }
  };

  if (!isOpen) return null;

  const bgClass = isNotion
    ? 'bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700'
    : isMonet
      ? 'bg-rose-50/95 dark:bg-gray-900/95 border-l border-rose-200/50 dark:border-rose-800/30 backdrop-blur-xl'
      : isApple
        ? 'apple-glass border-l border-gray-200 dark:border-gray-700'
        : isForsion1
          ? 'forsion1-glass border-l border-[#d5d0c8] dark:border-gray-700'
          : 'bg-white/95 dark:bg-gray-900/95 border-l border-gray-200 dark:border-gray-700 backdrop-blur-xl';

  const accentText = isNotion
    ? 'text-gray-800 dark:text-gray-200'
    : isMonet
      ? 'text-rose-600 dark:text-rose-300'
      : isApple
        ? 'text-blue-600 dark:text-blue-400'
        : isForsion1
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-forsion-600 dark:text-cyan-400';

  return (
    <AnimatedPanel side="right" className={`fixed top-0 right-0 h-full w-80 z-40 shadow-2xl flex flex-col ${bgClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className={accentText} />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Workspace</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">{files.length} files</span>
        </div>
        <div className="flex gap-1">
          <button onClick={refresh} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 transition-colors"><RefreshCw size={14} /></button>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 transition-colors"><X size={16} /></button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {files.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-xs">
            <FolderOpen size={32} className="mx-auto mb-2 opacity-30" />
            <p>No files in workspace</p>
            <p className="mt-1">Upload files or let the agent create them</p>
          </div>
        )}
        {files.map((f) => {
          const Icon = getFileIcon(f.mimeType);
          return (
            <div
              key={f.path}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 group text-xs"
            >
              <Icon size={14} className={`shrink-0 ${accentText}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-gray-900 dark:text-gray-100">{f.path}</div>
                <div className="text-gray-500 dark:text-gray-400">{formatSize(f.size)} &middot; {new Date(f.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => handlePreview(f.path, f.mimeType)} className="p-1 hover:text-blue-400" title="Preview">
                  <Eye size={12} />
                </button>
                <button onClick={() => handleDownload(f.path)} className="p-1 hover:text-green-400" title="Download">
                  <Download size={12} />
                </button>
                <button onClick={() => handleDelete(f.path)} className="p-1 hover:text-red-400" title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview overlay */}
      {(previewUrl || previewName) && (
        <div className="absolute inset-0 bg-black/80 z-10 flex flex-col p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-white font-medium truncate">{previewName.split('\n')[0]}</span>
            <button onClick={() => { setPreviewUrl(null); setPreviewName(''); }} className="text-white/60 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="max-w-full rounded-lg" />
            ) : (
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{previewName.split('\n').slice(2).join('\n')}</pre>
            )}
          </div>
        </div>
      )}
    </AnimatedPanel>
  );
};

export default WorkspacePanel;
