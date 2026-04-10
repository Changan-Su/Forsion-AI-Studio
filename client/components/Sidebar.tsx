import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, LogOut, Settings, X, MoreHorizontal, Edit2, Archive, ArchiveRestore, ChevronDown, ChevronRight } from 'lucide-react';
import { ChatSession, User, UserRole } from '../types';
import EmojiPicker from './EmojiPicker';
import { AnimatePresence, AnimatedOverlay, AnimatedDropdown, AnimatedCollapse, motion } from './AnimatedUI';
import { API_ROOT } from '../services/backendService';
import { useI18n } from '../i18n';

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
  themePreset: import('../types').ThemePreset;
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
  const isApple = themePreset === 'apple';
  const isForsion1 = themePreset === 'forsion1';
  const isQbird = themePreset === 'qbird';
  const { t, locale } = useI18n();

  // Refs
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false); // Flag to prevent click during save
  const emojiButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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
    if (isSavingRef.current) return; // Prevent double save
    isSavingRef.current = true;
    
    if (editingSessionId && editingTitle.trim()) {
      onRenameSession(editingSessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle('');
    
    // Reset flag after a short delay
    setTimeout(() => {
      isSavingRef.current = false;
    }, 100);
  };

  const handleCancelRename = () => {
    if (isSavingRef.current) return;
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
      style={{ borderRadius: 'var(--radius-sm)' }}
      className={`group relative flex items-center gap-2 px-3 py-3 cursor-pointer transition-all border ${
        currentSessionId === session.id
          ? isNotion
            ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-semibold'
            : isMonet 
              ? 'bg-white/50 border-white/30 text-[#4A4B6A] font-bold shadow-sm backdrop-blur-md'
              : isApple
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40 text-blue-900 dark:text-blue-100 font-semibold'
                : isForsion1
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40 text-amber-900 dark:text-amber-100 font-semibold'
                  : isQbird
                    ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-700/40 text-cyan-900 dark:text-cyan-100 font-semibold'
                    : 'bg-white/90 border-white/80 text-gray-900 dark:bg-white/10 dark:border-white/20 dark:text-white font-semibold shadow-[0_12px_30px_rgba(15,23,42,0.08)]'
          : isNotion
            ? 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
            : isMonet
              ? 'border-transparent hover:bg-white/30 text-[#4A4B6A]/80 hover:text-[#4A4B6A] font-medium'
              : isApple
                ? 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:text-blue-900 dark:hover:text-blue-100'
                : isForsion1
                  ? 'border-transparent text-stone-600 dark:text-stone-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:text-amber-900 dark:hover:text-amber-100'
                  : isQbird
                    ? 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 hover:text-cyan-900 dark:hover:text-cyan-100'
                    : 'bg-white/30 border-transparent text-gray-600 dark:bg-white/5 dark:text-gray-300 hover:bg-white/60 hover:border-white/70 dark:hover:bg-white/10 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-white'
      }`}
      onClick={() => {
        // Don't select session if we're currently editing
        if (editingSessionId === session.id) return;
        onSelectSession(session.id);
        onClose();
      }}
    >
      {/* Emoji/Icon - Clickable */}
      <button
        ref={(el) => {
          if (el) {
            emojiButtonRefs.current.set(session.id, el);
          } else {
            emojiButtonRefs.current.delete(session.id);
          }
        }}
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
          buttonRef={{ current: emojiButtonRefs.current.get(session.id) || null } as React.RefObject<HTMLElement>}
        />
      )}

      {/* Title - Editable or Display */}
      {editingSessionId === session.id ? (
        <input
          ref={editInputRef}
          type="text"
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onBlur={(e) => {
            // Use setTimeout to prevent conflict with onClick
            setTimeout(() => {
              if (!isSavingRef.current) {
                handleSaveRename();
              }
            }, 200);
          }}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
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
        <AnimatePresence>
          {showMenuFor === session.id && (
            <AnimatedDropdown
              key="session-menu"
              origin="top-right"
              className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-[var(--radius-sm)] shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]"
            >
              <div ref={menuRef}>
                <button
                  onClick={(e) => handleStartRename(session, e)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
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
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
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
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </AnimatedDropdown>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <AnimatedOverlay
            key="sidebar-overlay"
            onClick={onClose}
            className="bg-black/50 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 
        ${isNotion
          ? 'bg-notion-sidebar dark:bg-notion-darksidebar border-r border-notion-border dark:border-notion-darkborder'
          : isMonet 
            ? 'bg-white/30 backdrop-blur-xl border-r border-white/20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]'
            : isApple
              ? 'apple-glass border-r border-gray-200 dark:border-gray-700/50'
            : isForsion1
              ? 'forsion1-glass border-r border-[#d5d0c8] dark:border-gray-700/50'
            : isQbird
              ? 'qbird-glass border-r border-gray-200/50 dark:border-gray-700/30'
            : 'bg-gradient-to-b from-white/90 via-slate-50/80 to-slate-100/70 dark:from-[#0e1325]/90 dark:via-[#070b18]/85 dark:to-[#020409]/90 border-r border-white/30 dark:border-slate-800/80 backdrop-blur-2xl shadow-[0_25px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_15px_40px_rgba(2,6,23,0.7)]'
        }
        transform transition-transform duration-300 ease-in-out flex flex-col text-gray-700 dark:text-gray-200
        md:relative md:translate-x-0 md:w-56
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <div className={`flex items-center gap-2 font-bold text-xl tracking-wider ${
              isNotion ? 'text-gray-900 dark:text-white' : isMonet ? 'text-[#4A4B6A] font-cursive text-2xl drop-shadow-sm' : isApple ? 'text-blue-600 dark:text-blue-400' : isForsion1 ? 'text-amber-800 dark:text-amber-300' : isQbird ? 'text-cyan-600 dark:text-cyan-400' : 'text-forsion-600 dark:text-forsion-400'
            }`}>
              <div className={`w-8 h-8 flex items-center justify-center shadow-lg ${
                isNotion ? 'bg-gray-900 dark:bg-white' : isMonet ? 'bg-[#4A4B6A] backdrop-blur-md border border-white/20' : isApple ? 'bg-blue-500' : isForsion1 ? 'bg-amber-700' : isQbird ? 'bg-cyan-600' : 'bg-gradient-to-tr from-forsion-500 to-purple-600'
              }`} style={{ borderRadius: 'var(--radius-sm)' }}>
                <span className={isNotion ? 'text-white dark:text-black' : 'text-white'}>F</span>
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
            style={{ borderRadius: 'var(--radius-md)' }}
            className={`w-full flex items-center gap-2 px-4 py-3 transition-all duration-200 ease-out active:scale-[0.97] ${
              isNotion
                ? 'bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 font-medium shadow-sm'
                : isMonet 
                  ? 'bg-[#4A4B6A] hover:bg-[#3E406F] border border-white/20 text-white font-medium shadow-xl backdrop-blur'
                  : isApple
                    ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-400/30 hover:-translate-y-0.5'
                    : isForsion1
                      ? 'bg-amber-700 hover:bg-amber-800 text-white shadow-md shadow-amber-700/20 border border-amber-600/30 hover:-translate-y-0.5'
                      : isQbird
                        ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-600/20 border border-cyan-500/30'
                        : 'bg-gradient-to-r from-forsion-500 to-indigo-500 hover:from-forsion-400 hover:to-indigo-400 text-white border border-white/40 shadow-xl shadow-forsion-500/30 hover:-translate-y-0.5 backdrop-blur'
            }`}
          >
            <Plus size={18} />
            <span>{t('sidebar.newChat')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {/* Active Chats */}
          <div className="px-2 pt-2 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            {t('sidebar.history')}
          </div>
          {sessions.length === 0 && (
            <div className="text-center text-gray-400 dark:text-gray-500 text-sm mt-10">{t('sidebar.noHistory')}</div>
          )}
          {sessions.map((session) => renderSessionItem(session, false))}

          {/* Archived Section */}
          {archivedSessions.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchivedSection(!showArchivedSection)}
                className="w-full flex items-center gap-2 px-2 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-400 transition-colors duration-200"
              >
                <motion.div
                  animate={{ rotate: showArchivedSection ? 90 : 0 }}
                  transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <ChevronRight size={14} />
                </motion.div>
                {t('sidebar.archived')} ({archivedSessions.length})
              </button>
              <AnimatedCollapse isOpen={showArchivedSection}>
                <div className="space-y-1 mt-1">
                  {archivedSessions.map((session) => renderSessionItem(session, true))}
                </div>
              </AnimatedCollapse>
            </div>
          )}
        </div>

        <div className={`p-4 border-t ${
          isNotion
            ? 'border-notion-border dark:border-notion-darkborder bg-notion-sidebar dark:bg-notion-darksidebar'
            : isMonet 
              ? 'border-white/10 bg-white/5'
              : isApple
                ? 'border-gray-200 dark:border-gray-700/50'
                : isForsion1
                  ? 'border-[#d5d0c8] dark:border-gray-700/50'
                  : isQbird
                    ? 'border-gray-200/50 dark:border-gray-700/30'
                    : 'border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl'
        }`}>
          <div
            className="flex items-center gap-3 mb-4 cursor-pointer rounded-lg p-1 -m-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => {
              const token = localStorage.getItem('auth_token') || '';
              window.open(`${API_ROOT}/account?token=${encodeURIComponent(token)}`, '_blank');
            }}
            title="Account Center"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm overflow-hidden ${
              isMonet ? 'bg-[#4A4B6A] border border-white/20' : isApple ? 'bg-blue-500' : isForsion1 ? 'bg-amber-700' : isQbird ? 'bg-cyan-600' : 'bg-gradient-to-br from-indigo-500 to-purple-500'
            }`}>
              {user.avatar ? (
                <img src={user.avatar} alt={user.nickname || user.username} className="w-full h-full object-cover" />
              ) : (
                <span>{(user.nickname || user.username).substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-medium truncate ${isMonet ? 'text-[#4A4B6A] font-bold' : 'text-gray-900 dark:text-gray-100'}`}>
                  {user.nickname || user.username}
                </p>
                {user.membershipTier && user.membershipTier !== 'free' && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${
                    user.membershipTier === 'pro'
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white'
                      : 'bg-gradient-to-r from-amber-400 to-orange-400 text-white'
                  }`}>
                    {user.membershipTier}
                  </span>
                )}
              </div>
              <p className={`text-xs truncate ${isMonet ? 'text-[#4A4B6A]/70' : 'text-gray-500 dark:text-gray-400'}`}>
                {locale === 'en' ? 'Account Center' : '用户中心'}
              </p>
            </div>
          </div>
          <p className={`text-[10px] mb-3 -mt-2 ml-1 ${isMonet ? 'text-[#4A4B6A]/40' : 'text-gray-400 dark:text-gray-600'}`}>
            {t('sidebar.account')}
          </p>

          <div className="space-y-1">
            <button
              onClick={() => { onOpenSettings(); onClose(); }}
              style={{ borderRadius: 'var(--radius-xs)' }}
              className={`w-full flex items-center gap-2 text-sm px-3 py-2 transition-colors ${
                isMonet
                  ? 'text-[#4A4B6A] hover:bg-white/40 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-forsion-300 hover:bg-white/70 dark:hover:bg-white/10'
              }`}
            >
              <Settings size={16} />
              {t('sidebar.settings')}
            </button>
            <button
              onClick={onLogout}
              style={{ borderRadius: 'var(--radius-xs)' }}
              className={`w-full flex items-center gap-2 text-sm px-3 py-2 transition-colors ${
                isMonet
                  ? 'text-[#4A4B6A]/90 hover:bg-red-500/10 hover:text-red-600 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white/70 dark:hover:bg-white/10'
              }`}
            >
              <LogOut size={16} />
              {t('sidebar.logout')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
