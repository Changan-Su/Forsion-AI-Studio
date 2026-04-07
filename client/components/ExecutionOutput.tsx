import React from 'react';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

interface ExecutionOutputProps {
  stdout: string;
  stderr: string;
  images: Array<{ path: string; dataUrl: string }>;
  isRunning: boolean;
  durationMs?: number;
  themePreset: import('../types').ThemePreset;
}

const ExecutionOutput: React.FC<ExecutionOutputProps> = ({
  stdout, stderr, images, isRunning, durationMs, themePreset,
}) => {
  const isNotion = themePreset === 'notion';

  if (isRunning) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-yellow-400 bg-[#1e1e1e] border-t border-gray-700">
        <Loader2 size={12} className="animate-spin" />
        <span>Running Python...</span>
      </div>
    );
  }

  if (!stdout && !stderr && images.length === 0) return null;

  return (
    <div className={`border-t ${isNotion ? 'border-gray-200 dark:border-gray-700' : 'border-gray-700'} bg-[#1a1a2e]`}>
      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] opacity-60">
        {stderr ? (
          <><AlertTriangle size={10} className="text-yellow-400" /><span>Completed with warnings</span></>
        ) : (
          <><CheckCircle size={10} className="text-green-400" /><span>Executed successfully</span></>
        )}
        {durationMs !== undefined && <span className="ml-auto">{durationMs}ms</span>}
      </div>

      {/* stdout */}
      {stdout && (
        <pre className="px-4 py-2 text-xs text-gray-200 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
          {stdout}
        </pre>
      )}

      {/* stderr */}
      {stderr && (
        <pre className="px-4 py-2 text-xs text-yellow-300 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap font-mono border-t border-gray-700/50">
          {stderr}
        </pre>
      )}

      {/* Generated images */}
      {images.length > 0 && (
        <div className="px-4 py-2 space-y-2 border-t border-gray-700/50">
          {images.map((img, i) => (
            <div key={i}>
              <div className="text-[10px] text-gray-400 mb-1">{img.path}</div>
              <img src={img.dataUrl} alt={img.path} className="max-w-full rounded-lg border border-gray-700" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExecutionOutput;
