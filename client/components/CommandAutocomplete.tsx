import React from 'react';
import { Image as ImageIcon, BrainCircuit, Sparkles } from 'lucide-react';

export interface Command {
  command: string;
  description: string;
  icon?: React.ReactNode;
  category: 'image' | 'thinking' | 'other';
}

export const AVAILABLE_COMMANDS: Command[] = [
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
    command: '/dt',
    description: 'Enable deep thinking for this message',
    icon: <BrainCircuit size={14} />,
    category: 'thinking'
  },
];

interface CommandAutocompleteProps {
  input: string;
  cursorPosition: number;
  onSelect: (command: string) => void;
  onClose: () => void;
  isNotion?: boolean;
}

const CommandAutocomplete: React.FC<CommandAutocompleteProps> = ({
  input,
  cursorPosition,
  onSelect,
  onClose,
  isNotion = false
}) => {
  // Extract the command prefix (everything after '/' up to cursor)
  const textBeforeCursor = input.substring(0, cursorPosition);
  const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
  
  if (lastSlashIndex === -1) {
    return null;
  }

  const commandPrefix = textBeforeCursor.substring(lastSlashIndex + 1).toLowerCase();
  
  // Filter commands that match the prefix
  const matchingCommands = AVAILABLE_COMMANDS.filter(cmd =>
    cmd.command.toLowerCase().startsWith('/' + commandPrefix)
  );

  if (matchingCommands.length === 0 && commandPrefix.length > 0) {
    return null;
  }

  // Show all commands if no prefix or empty prefix
  const commandsToShow = commandPrefix.length === 0 
    ? AVAILABLE_COMMANDS 
    : matchingCommands;

  if (commandsToShow.length === 0) {
    return null;
  }

  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Handle keyboard navigation
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

  // Calculate position (above the input)
  return (
    <div
      className={`absolute bottom-full left-0 mb-2 w-64 rounded-xl shadow-xl border z-50 max-h-64 overflow-y-auto ${
        isNotion
          ? 'bg-white dark:bg-notion-darksidebar border-notion-border dark:border-notion-darkborder'
          : 'bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border'
      }`}
      style={{ maxHeight: '256px' }}
    >
      <div className={`px-3 py-2 text-xs font-semibold ${
        isNotion
          ? 'text-gray-500 dark:text-gray-400'
          : 'text-gray-500 dark:text-dark-muted'
      } uppercase tracking-wider border-b border-gray-200 dark:border-dark-border`}>
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
    </div>
  );
};

export default CommandAutocomplete;


