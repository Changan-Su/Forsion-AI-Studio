import React from 'react';
import ReactDOM from 'react-dom';
import { Image as ImageIcon, BrainCircuit, Sparkles, Edit, RefreshCw } from 'lucide-react';
import { motion } from './AnimatedUI';

export interface Command {
  command: string;
  description: string;
  icon?: React.ReactNode;
  category: 'image' | 'thinking' | 'skill' | 'other';
}

export const BUILTIN_COMMANDS: Command[] = [
  {
    command: '/draw',
    description: 'Generate an image',
    icon: <ImageIcon size={14} />,
    category: 'image'
  },
  {
    command: '/image',
    description: 'Generate an image',
    icon: <ImageIcon size={14} />,
    category: 'image'
  },
  {
    command: '/generate',
    description: 'Generate an image',
    icon: <ImageIcon size={14} />,
    category: 'image'
  },
  {
    command: '/paint',
    description: 'Generate an image',
    icon: <ImageIcon size={14} />,
    category: 'image'
  },
  {
    command: '/edit',
    description: 'Edit uploaded image',
    icon: <Edit size={14} />,
    category: 'image'
  },
  {
    command: '/img2img',
    description: 'Generate image from image',
    icon: <RefreshCw size={14} />,
    category: 'image'
  },
  {
    command: '/dt',
    description: 'Enable deep thinking for this message',
    icon: <BrainCircuit size={14} />,
    category: 'thinking'
  },
];

// For backward compatibility
export const AVAILABLE_COMMANDS = BUILTIN_COMMANDS;

interface CommandAutocompleteProps {
  input: string;
  cursorPosition: number;
  onSelect: (command: string) => void;
  onClose: () => void;
  isNotion?: boolean;
  extraCommands?: Command[];
}

const CommandAutocomplete: React.FC<CommandAutocompleteProps> = ({
  input,
  cursorPosition,
  onSelect,
  onClose,
  isNotion = false,
  extraCommands = []
}) => {
  const allCommands = React.useMemo(() => [...BUILTIN_COMMANDS, ...extraCommands], [extraCommands]);

  // Extract the command prefix (everything after '/' up to cursor)
  const textBeforeCursor = input.substring(0, cursorPosition);
  const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
  
  if (lastSlashIndex === -1) {
    return null;
  }

  const commandPrefix = textBeforeCursor.substring(lastSlashIndex + 1).toLowerCase();
  
  const matchingCommands = allCommands.filter(cmd =>
    cmd.command.toLowerCase().startsWith('/' + commandPrefix)
  );

  if (matchingCommands.length === 0 && commandPrefix.length > 0) {
    return null;
  }

  const commandsToShow = commandPrefix.length === 0 
    ? allCommands 
    : matchingCommands;

  if (commandsToShow.length === 0) {
    return null;
  }

  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ bottom: number; left: number } | null>(null);

  // Position the portal element above the textarea using the parent's bounding rect
  React.useLayoutEffect(() => {
    const parent = (containerRef.current?.parentElement as HTMLElement | null) ??
      document.querySelector('textarea');
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    setPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
  }, [input, cursorPosition]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [commandPrefix]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % commandsToShow.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + commandsToShow.length) % commandsToShow.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(commandsToShow[selectedIndex].command);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, commandsToShow, onSelect, onClose]);

  // Hidden ref anchor to locate the parent
  const anchor = <div ref={containerRef} className="hidden" />;

  const dropdown = pos ? ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ position: 'fixed', bottom: pos.bottom, left: pos.left, transformOrigin: '50% 100%', maxHeight: '320px', zIndex: 9999 }}
      className={`w-72 rounded-xl shadow-2xl border overflow-y-auto ${
        isNotion
          ? 'bg-white dark:bg-notion-darksidebar border-notion-border dark:border-notion-darkborder'
          : 'bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border'
      }`}
    >
      <div className={`px-3 py-2 text-xs font-semibold ${
        isNotion
          ? 'text-gray-500 dark:text-gray-400'
          : 'text-gray-500 dark:text-dark-muted'
      } uppercase tracking-wider border-b border-gray-200 dark:border-dark-border sticky top-0 ${
        isNotion ? 'bg-white dark:bg-notion-darksidebar' : 'bg-white dark:bg-dark-card'
      }`}>
        Commands
      </div>
      {commandsToShow.map((cmd, index) => (
        <button
          key={cmd.command}
          type="button"
          onClick={() => onSelect(cmd.command)}
          className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
            index === selectedIndex
              ? isNotion
                ? 'bg-gray-100 dark:bg-black/30'
                : 'bg-slate-100 dark:bg-white/5'
              : 'hover:bg-gray-50 dark:hover:bg-white/5'
          }`}
        >
          <div className={`flex-shrink-0 ${
            index === selectedIndex
              ? isNotion
                ? 'text-gray-600 dark:text-gray-300'
                : 'text-forsion-600 dark:text-forsion-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}>
            {cmd.icon || <Sparkles size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium ${
              index === selectedIndex
                ? isNotion
                  ? 'text-black dark:text-white'
                  : 'text-forsion-600 dark:text-forsion-400'
                : 'text-gray-900 dark:text-dark-text'
            }`}>
              {cmd.command}
            </div>
            <div className={`text-xs ${
              isNotion
                ? 'text-gray-500 dark:text-gray-400'
                : 'text-gray-500 dark:text-dark-muted'
            }`}>
              {cmd.description}
            </div>
          </div>
        </button>
      ))}
    </motion.div>,
    document.body
  ) : null;

  return <>{anchor}{dropdown}</>;
};

export default CommandAutocomplete;
