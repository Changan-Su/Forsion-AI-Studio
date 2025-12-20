import React, { useState, useRef, useEffect } from 'react';
import { Shuffle, X } from 'lucide-react';

// Common emojis organized by category
const EMOJI_LIST = [
  // Smileys
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛',
  '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
  // Expressions
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
  '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
  '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐',
  // Fantasy & Fun
  '😈', '👿', '👹', '👺', '💀', '☠️', '👻', '👽', '👾', '🤖',
  '💩', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
  // Celebration
  '🎉', '🎊', '🎈', '🎁', '🎀', '🎂', '🎄', '🎃', '🎆', '🎇',
  '✨', '🎐', '🎑', '🎍', '🎋', '🎏', '🎎', '🏮', '🎗️', '🎟️',
  // Objects & Symbols
  '💡', '🔥', '⭐', '🌟', '💫', '💥', '💢', '💤', '💨', '💦',
  '📝', '📌', '📍', '📎', '🔗', '💼', '📁', '📂', '📰', '📚',
  '💻', '🖥️', '⌨️', '🖱️', '🖲️', '💾', '📀', '🎵', '🎶', '🎧',
  // Nature
  '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️',
  '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱',
  // Animals
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦄',
  // Food
  '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒',
  '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥗', '🍜', '🍣',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose, position }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleRandomEmoji = () => {
    const randomIndex = Math.floor(Math.random() * EMOJI_LIST.length);
    onSelect(EMOJI_LIST[randomIndex]);
  };

  const handleSelectEmoji = (emoji: string) => {
    onSelect(emoji);
  };

  const filteredEmojis = searchTerm
    ? EMOJI_LIST.filter(emoji => emoji.includes(searchTerm))
    : EMOJI_LIST;

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 w-72"
      style={position ? { top: position.top, left: position.left } : { top: '100%', left: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Choose Emoji</h4>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Random Button */}
      <button
        onClick={handleRandomEmoji}
        className="w-full flex items-center justify-center gap-2 mb-3 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-sm font-medium rounded-lg transition-all hover:scale-[1.02] active:scale-95"
      >
        <Shuffle size={14} />
        Random Emoji
      </button>

      {/* Emoji Grid */}
      <div className="max-h-48 overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {filteredEmojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => handleSelectEmoji(emoji)}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors hover:scale-110"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Clear option */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onSelect('')}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Remove Emoji
        </button>
      </div>
    </div>
  );
};

export default EmojiPicker;



