import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { ToolCall, ToolResult } from '../types';

interface ToolCallBlockProps {
  toolCall: ToolCall;
  toolResult?: ToolResult;
  isLoading: boolean;
  themePreset: 'default' | 'notion' | 'monet';
}

const ToolCallBlock: React.FC<ToolCallBlockProps> = ({
  toolCall,
  toolResult,
  isLoading,
  themePreset,
}) => {
  const [expanded, setExpanded] = useState(false);

  const isNotion = themePreset === 'notion';
  const isMonet = themePreset === 'monet';

  const containerClass = isNotion
    ? 'border border-gray-200 dark:border-gray-700 rounded-md my-1'
    : isMonet
      ? 'border border-rose-200/50 dark:border-rose-800/30 rounded-lg my-1'
      : 'border border-cyan-500/30 rounded-lg my-1';

  const headerClass = isNotion
    ? 'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md text-sm'
    : isMonet
      ? 'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-rose-50/30 dark:hover:bg-rose-900/20 rounded-lg text-sm'
      : 'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-cyan-500/5 rounded-lg text-sm';

  const labelClass = isNotion
    ? 'text-gray-600 dark:text-gray-400'
    : isMonet
      ? 'text-rose-700 dark:text-rose-300'
      : 'text-cyan-400';

  const bodyClass = isNotion
    ? 'px-3 pb-2 text-xs font-mono text-gray-700 dark:text-gray-300'
    : isMonet
      ? 'px-3 pb-2 text-xs font-mono text-gray-700 dark:text-gray-300'
      : 'px-3 pb-2 text-xs font-mono text-gray-300';

  const durationMs = toolResult?.durationMs;

  const StatusIcon = isLoading
    ? Loader2
    : toolResult?.isError
      ? XCircle
      : CheckCircle;

  const statusColor = isLoading
    ? 'text-yellow-400'
    : toolResult?.isError
      ? 'text-red-400'
      : 'text-green-400';

  return (
    <div className={containerClass}>
      <div className={headerClass} onClick={() => setExpanded(!expanded)}>
        {expanded ? (
          <ChevronDown size={13} className="shrink-0 opacity-60" />
        ) : (
          <ChevronRight size={13} className="shrink-0 opacity-60" />
        )}
        <Wrench size={13} className={`shrink-0 ${labelClass}`} />
        <span className={`font-medium ${labelClass}`}>{toolCall.name}</span>
        {durationMs !== undefined && !isLoading && (
          <span className="opacity-50 text-xs ml-1">{durationMs}ms</span>
        )}
        <StatusIcon
          size={13}
          className={`ml-auto shrink-0 ${statusColor} ${isLoading ? 'animate-spin' : ''}`}
        />
      </div>

      {expanded && (
        <div className={bodyClass}>
          <div className="mb-2">
            <div className="opacity-50 mb-1 text-[10px] uppercase tracking-wider">Arguments</div>
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          {toolResult && (
            <div>
              <div className={`opacity-50 mb-1 text-[10px] uppercase tracking-wider ${toolResult.isError ? 'text-red-400' : ''}`}>
                {toolResult.isError ? 'Error' : 'Result'}
              </div>
              <pre className={`whitespace-pre-wrap break-all ${toolResult.isError ? 'text-red-400' : ''}`}>
                {typeof toolResult.result === 'string'
                  ? toolResult.result
                  : JSON.stringify(toolResult.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolCallBlock;
