import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle, Loader2, RotateCw, Clock } from 'lucide-react';
import type { ToolCall, ToolResult } from '../types';
import { AnimatedCollapse } from './AnimatedUI';

interface ToolCallBlockProps {
  toolCall: ToolCall;
  toolResult?: ToolResult;
  isLoading: boolean;
  themePreset: string;
  onRetry?: (toolCall: ToolCall) => void;
}

const ToolCallBlock: React.FC<ToolCallBlockProps> = ({
  toolCall,
  toolResult,
  isLoading,
  themePreset,
  onRetry,
}) => {
  const isError = toolResult?.isError ?? false;
  const [expanded, setExpanded] = useState(isError);

  const isNotion = themePreset === 'notion';
  const isMonet = themePreset === 'monet';

  const statusColor = isLoading
    ? 'text-amber-500'
    : isError
      ? 'text-red-500'
      : 'text-green-500';

  const borderColor = isLoading
    ? isNotion ? 'border-amber-200 dark:border-amber-800/40' : isMonet ? 'border-amber-300/40' : 'border-amber-500/30'
    : isError
      ? isNotion ? 'border-red-200 dark:border-red-800/40' : isMonet ? 'border-red-300/40' : 'border-red-500/30'
      : isNotion ? 'border-green-200 dark:border-green-800/40' : isMonet ? 'border-green-300/40' : 'border-green-500/30';

  const labelClass = isNotion
    ? 'text-gray-700 dark:text-gray-300'
    : isMonet
      ? 'text-rose-700 dark:text-rose-300'
      : 'text-cyan-400';

  const durationMs = toolResult?.durationMs;
  const isTimeout = durationMs !== undefined && durationMs >= 30000;

  const StatusIcon = isLoading ? Loader2 : isTimeout ? Clock : isError ? XCircle : CheckCircle;

  return (
    <div className={`border rounded-lg my-1.5 overflow-hidden ${borderColor}`}>
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors ${
          isNotion ? 'hover:bg-gray-50 dark:hover:bg-gray-800'
            : isMonet ? 'hover:bg-white/10'
            : 'hover:bg-white/5 dark:hover:bg-zinc-800/50'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={13} className="shrink-0 opacity-60" />
        ) : (
          <ChevronRight size={13} className="shrink-0 opacity-60" />
        )}
        <Wrench size={13} className={`shrink-0 ${labelClass}`} />
        <span className={`font-medium ${labelClass}`}>{toolCall.name}</span>

        {isLoading && (
          <span className="text-xs text-amber-500 ml-1">Executing...</span>
        )}
        {!isLoading && durationMs !== undefined && (
          <span className="text-xs opacity-50 ml-1">
            {durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {isError && onRetry && (
            <button
              onClick={e => { e.stopPropagation(); onRetry(toolCall); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
            >
              <RotateCw size={10} />
              Retry
            </button>
          )}
          <StatusIcon
            size={14}
            className={`shrink-0 ${statusColor} ${isLoading ? 'animate-spin' : ''}`}
          />
        </div>
      </div>

      {/* Error summary (always visible when error) */}
      {isError && !expanded && toolResult && (
        <div className="px-3 pb-2 text-xs text-red-500 dark:text-red-400 truncate">
          {typeof toolResult.result === 'string' ? toolResult.result : 'Tool execution failed'}
        </div>
      )}

      {/* Expanded details */}
      <AnimatedCollapse isOpen={expanded}>
        <div className={`px-3 pb-3 text-xs font-mono border-t ${
          isNotion ? 'border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300'
            : isMonet ? 'border-white/10 text-gray-700 dark:text-gray-300'
            : 'border-white/5 text-gray-300'
        }`}>
          <div className="mt-2 mb-2">
            <div className="opacity-50 mb-1 text-[10px] uppercase tracking-wider">Arguments</div>
            <pre className="whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          {toolResult && (
            <div>
              <div className={`opacity-50 mb-1 text-[10px] uppercase tracking-wider ${isError ? 'text-red-400' : ''}`}>
                {isError ? 'Error' : 'Result'}
              </div>
              <pre className={`whitespace-pre-wrap break-all max-h-48 overflow-y-auto ${isError ? 'text-red-400' : ''}`}>
                {typeof toolResult.result === 'string'
                  ? toolResult.result
                  : JSON.stringify(toolResult.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </AnimatedCollapse>
    </div>
  );
};

export default ToolCallBlock;
