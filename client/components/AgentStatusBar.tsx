import React from 'react';
import { Bot, Loader2 } from 'lucide-react';

interface AgentStatusBarProps {
  isActive: boolean;
  currentIteration: number;
  maxIterations: number;
  currentToolName?: string;
  themePreset: 'default' | 'notion' | 'monet';
}

const AgentStatusBar: React.FC<AgentStatusBarProps> = ({
  isActive,
  currentIteration,
  maxIterations,
  currentToolName,
  themePreset,
}) => {
  if (!isActive) return null;

  const isNotion = themePreset === 'notion';
  const isMonet = themePreset === 'monet';

  const barClass = isNotion
    ? 'flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 border-t border-gray-100 dark:border-gray-800'
    : isMonet
      ? 'flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 border-t border-rose-100/50 dark:border-rose-900/30'
      : 'flex items-center gap-2 px-3 py-1.5 text-xs text-cyan-400 border-t border-cyan-500/20';

  return (
    <div className={barClass}>
      <Loader2 size={12} className="animate-spin shrink-0" />
      <Bot size={12} className="shrink-0" />
      <span>
        {currentToolName ? (
          <>
            Running <span className="font-mono font-medium">{currentToolName}</span>
          </>
        ) : (
          'Agent thinking…'
        )}
      </span>
      <span className="ml-auto opacity-60">
        {currentIteration + 1}/{maxIterations}
      </span>
    </div>
  );
};

export default AgentStatusBar;
