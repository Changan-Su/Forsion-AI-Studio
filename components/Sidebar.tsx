import React from 'react';
import { MessageSquare, Plus, Trash2, LogOut, Settings, X, Moon, Sun } from 'lucide-react';
import { ChatSession, User, UserRole } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  user: User;
  onLogout: () => void;
  onOpenSettings: () => void;
  isOpen: boolean; // Mobile state
  onClose: () => void; // Mobile closer
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  user,
  onLogout,
  onOpenSettings,
  isOpen,
  onClose
}) => {
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
        fixed inset-y-0 left-0 z-40 w-72 bg-gray-50 dark:bg-forsion-cardbg border-r border-gray-200 dark:border-gray-700 
        transform transition-transform duration-300 ease-in-out flex flex-col text-gray-700 dark:text-gray-200
        md:relative md:translate-x-0 md:w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-forsion-600 dark:text-forsion-400 font-bold text-xl tracking-wider">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-forsion-500 to-purple-600 flex items-center justify-center shadow-lg">
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
            className="w-full flex items-center gap-2 bg-white dark:bg-forsion-600 hover:bg-gray-100 dark:hover:bg-forsion-500 text-gray-900 dark:text-white border border-gray-200 dark:border-transparent px-4 py-3 rounded-lg transition-all duration-200 shadow-sm dark:shadow-lg dark:shadow-forsion-900/50"
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          <div className="px-2 pt-2 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            History
          </div>
          {sessions.length === 0 && (
            <div className="text-center text-gray-400 dark:text-gray-500 text-sm mt-10">No history yet.</div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors ${
                currentSessionId === session.id
                  ? 'bg-gray-200 dark:bg-gray-700/50 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              onClick={() => { onSelectSession(session.id); onClose(); }}
            >
              <MessageSquare size={16} />
              <span className="truncate text-sm flex-1">{session.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-900/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.username}</p>
              <p className="text-xs text-gray-500 truncate">{user.role}</p>
            </div>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => { onOpenSettings(); onClose(); }}
              className="w-full flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-forsion-300 px-2 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <Settings size={16} />
              Settings
            </button>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
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