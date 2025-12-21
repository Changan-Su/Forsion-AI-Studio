import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, LogOut, Settings, X, MoreHorizontal, Edit2, Archive, ArchiveRestore, ChevronDown, ChevronRight } from 'lucide-react';
import { ChatSession, User, UserRole } from '../types';
import CreditBalance from './CreditBalance';
import EmojiPicker from './EmojiPicker';

interface SidebarProps {
  sessions: ChatSession[];
  archivedSessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onArchiveSession: (id: string) => void;
  onUpdateSessionEmoji: (id: string, emoji: string) => void;
  user: User;
  onLogout: () => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onClose: () => void;
  themePreset: 'default' | 'notion' | 'monet';
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  archivedSessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onArchiveSession,
  onUpdateSessionEmoji,
  user,
  onLogout,
  onOpenSettings,
  isOpen,
  onClose,
  themePreset
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const [showArchivedSection, setShowArchivedSection] = useState(false);
  const isNotion = themePreset === 'notion';
  const isMonet = themePreset === 'monet';

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenuFor(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when editing
  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
    setShowMenuFor(null);
  };

  const handleSaveRename = () => {
    if (editingSessionId && editingTitle.trim()) {
      onRenameSession(editingSessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  const handleEmojiSelect = (sessionId: string, emoji: string) => {
    onUpdateSessionEmoji(sessionId, emoji);
    setShowEmojiPickerFor(null);
  };

  const renderSessionItem = (session: ChatSession, isArchived: boolean = false) => (
    <div
      key={session.id}
      className={`group relative flex items-center gap-2 px-3 py-3 rounded-2xl cursor-pointer transition-all border ${
        currentSessionId === session.id
          ? isMonet 
            ? 'bg-white/50 border-white/30 text-[#4A4B6A] font-bold shadow-sm backdrop-blur-md' 
            : 'bg-white/90 border-white/80 text-gray-900 dark:bg-white/10 dark:border-white/20 dark:text-white font-semibold shadow-[0_12px_30px_rgba(15,23,42,0.08)]'
          : isMonet
            ? 'border-transparent hover:bg-white/30 text-[#4A4B6A]/80 hover:text-[#4A4B6A] font-medium'
            : 'bg-white/30 border-transparent text-gray-600 dark:bg-white/5 dark:text-gray-300 hover:bg-white/60 hover:border-white/70 dark:hover:bg-white/10 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-white'
      }`}
      onClick={() => { onSelectSession(session.id); onClose(); }}
    >
      {/* Emoji/Icon - Clickable */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowEmojiPickerFor(showEmojiPickerFor === session.id ? null : session.id);
          setShowMenuFor(null);
        }}
        className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        title="Click to change emoji"
      >
        {session.emoji ? (
          <span className="text-base leading-none">{session.emoji}</span>
        ) : (
          <MessageSquare size={16} className="text-gray-400" />
        )}
      </button>

      {/* Emoji Picker */}
      {showEmojiPickerFor === session.id && (
        <EmojiPicker
          onSelect={(emoji) => handleEmojiSelect(session.id, emoji)}
          onClose={() => setShowEmojiPickerFor(null)}
          position={{ top: 0, left: 32 }}
        />
      )}

      {/* Title - Editable or Display */}
      {editingSessionId === session.id ? (
        <input
          ref={editInputRef}
          type="text"
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onBlur={handleSaveRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-forsion-500"
        />
      ) : (
        <span className="truncate text-sm flex-1">{session.title}</span>
      )}

      {/* Settings Menu Button */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenuFor(showMenuFor === session.id ? null : session.id);
            setShowEmojiPickerFor(null);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <MoreHorizontal size={16} />
        </button>

        {/* Dropdown Menu */}
        {showMenuFor === session.id && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]"
          >
            <button
              onClick={(e) => handleStartRename(session, e)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Edit2 size={14} />
              Rename
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchiveSession(session.id);
                setShowMenuFor(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {isArchived ? (
                <>
                  <ArchiveRestore size={14} />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive size={14} />
                  Archive
                </>
              )}
            </button>
            <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(session.id);
                setShowMenuFor(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-72 
        ${isMonet 
          ? 'bg-white/30 backdrop-blur-xl border-r border-white/20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]' 
          : 'bg-gradient-to-b from-white/90 via-slate-50/80 to-slate-100/70 dark:from-[#0e1325]/90 dark:via-[#070b18]/85 dark:to-[#020409]/90 border-r border-white/30 dark:border-slate-800/80 backdrop-blur-2xl shadow-[0_25px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_15px_40px_rgba(2,6,23,0.7)]'
        }
        transform transition-transform duration-300 ease-in-out flex flex-col text-gray-700 dark:text-gray-200
        md:relative md:translate-x-0 md:w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <div className={`flex items-center gap-2 font-bold text-xl tracking-wider ${isMonet ? 'text-[#4A4B6A] font-cursive text-2xl drop-shadow-sm' : 'text-forsion-600 dark:text-forsion-400'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-lg ${
                isMonet ? 'bg-[#4A4B6A] backdrop-blur-md border border-white/20' : 'bg-gradient-to-tr from-forsion-500 to-purple-600'
              }`}>
                <span className="text-white">F</span>
              </div>
              Forsion AI
            </div>
            {/* Mobile Close Button */}
            <button onClick={onClose} className="md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X size={24} />
            </button>
          </div>
          
          <button
            onClick={() => { onNewChat(); onClose(); }}
            className={`w-full flex items-center gap-2 text-white border border-white/40 px-4 py-3 rounded-2xl transition-transform duration-300 ease-out shadow-xl hover:-translate-y-0.5 active:scale-95 backdrop-blur ${
              isMonet 
                ? 'bg-[#4A4B6A] hover:bg-[#3E406F] border-white/20 text-white font-medium' 
                : 'bg-gradient-to-r from-forsion-500 to-indigo-500 hover:from-forsion-400 hover:to-indigo-400 shadow-forsion-500/30'
            }`}
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {/* Active Chats */}
          <div className="px-2 pt-2 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            History
          </div>
          {sessions.length === 0 && (
            <div className="text-center text-gray-400 dark:text-gray-500 text-sm mt-10">No history yet.</div>
          )}
          {sessions.map((session) => renderSessionItem(session, false))}

          {/* Archived Section */}
          {archivedSessions.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchivedSection(!showArchivedSection)}
                className="w-full flex items-center gap-2 px-2 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                {showArchivedSection ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Archived ({archivedSessions.length})
              </button>
              {showArchivedSection && (
                <div className="space-y-1 mt-1">
                  {archivedSessions.map((session) => renderSessionItem(session, true))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`p-4 border-t ${
          isMonet 
            ? 'border-white/10 bg-white/5' 
            : 'border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
              isMonet ? 'bg-[#4A4B6A] border border-white/20' : 'bg-gradient-to-br from-indigo-500 to-purple-500'
            }`}>
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className={`text-sm font-medium truncate ${isMonet ? 'text-[#4A4B6A] font-bold' : 'text-gray-900 dark:text-gray-100'}`}>{user.username}</p>
              <p className={`text-xs truncate ${isMonet ? 'text-[#4A4B6A]/70' : 'text-gray-500'}`}>{user.role}</p>
            </div>
          </div>

          <div className="mb-4">
            <CreditBalance />
          </div>

          <div className="space-y-1">
            <button
              onClick={() => { onOpenSettings(); onClose(); }}
              className={`w-full flex items-center gap-2 text-sm px-3 py-2 rounded-xl transition-colors ${
                isMonet
                  ? 'text-[#4A4B6A] hover:bg-white/40 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-forsion-300 hover:bg-white/70 dark:hover:bg-white/10'
              }`}
            >
              <Settings size={16} />
              Settings
            </button>
            <button
              onClick={onLogout}
              className={`w-full flex items-center gap-2 text-sm px-3 py-2 rounded-xl transition-colors ${
                isMonet
                  ? 'text-[#4A4B6A]/90 hover:bg-red-500/10 hover:text-red-600 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white/70 dark:hover:bg-white/10'
              }`}
            >
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
