import React from 'react';
import { Shield, X, Check, AlertTriangle } from 'lucide-react';

interface AuthorizationDialogProps {
  appId: string;
  appName: string;
  permissions: string[];
  onAllow: () => void;
  onDeny: () => void;
  themePreset: string;
}

const AuthorizationDialog: React.FC<AuthorizationDialogProps> = ({
  appId,
  appName,
  permissions,
  onAllow,
  onDeny,
  themePreset,
}) => {
  const isMonet = themePreset === 'monet';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
        isMonet ? 'glass-dark' : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700'
      }`}>
        <div className={`p-6 ${isMonet ? '' : 'border-b border-gray-100 dark:border-zinc-800'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isMonet ? 'bg-white/20' : 'bg-amber-50 dark:bg-amber-900/20'
            }`}>
              <Shield size={20} className={isMonet ? 'text-white' : 'text-amber-600 dark:text-amber-400'} />
            </div>
            <div>
              <h3 className={`font-semibold ${isMonet ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                Data Access Request
              </h3>
              <p className={`text-sm ${isMonet ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
                {appName} wants to access your data
              </p>
            </div>
          </div>

          <div className={`rounded-xl p-4 mb-4 ${
            isMonet ? 'bg-white/10' : 'bg-gray-50 dark:bg-zinc-800'
          }`}>
            <p className={`text-sm font-medium mb-3 ${isMonet ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
              Permissions requested:
            </p>
            <ul className="space-y-2">
              {permissions.map((perm, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check size={14} className={isMonet ? 'text-white/50' : 'text-green-500'} />
                  <span className={`text-sm ${isMonet ? 'text-white/70' : 'text-gray-600 dark:text-gray-400'}`}>
                    {perm}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`flex items-start gap-2 rounded-lg p-3 mb-4 ${
            isMonet ? 'bg-white/5' : 'bg-blue-50 dark:bg-blue-900/10'
          }`}>
            <AlertTriangle size={14} className={`shrink-0 mt-0.5 ${isMonet ? 'text-white/40' : 'text-blue-500'}`} />
            <p className={`text-xs leading-relaxed ${isMonet ? 'text-white/50' : 'text-blue-600 dark:text-blue-400'}`}>
              This authorization remains active until you revoke it in Settings &gt; Data Authorization. 
              Your data is only accessed when you interact with AI features that require it.
            </p>
          </div>
        </div>

        <div className={`flex gap-3 p-4 ${
          isMonet ? 'bg-white/5' : 'bg-gray-50 dark:bg-zinc-800/50'
        }`}>
          <button
            onClick={onDeny}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isMonet
                ? 'bg-white/10 text-white hover:bg-white/20'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-600'
            }`}
          >
            Deny
          </button>
          <button
            onClick={onAllow}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isMonet
                ? 'bg-white/25 text-white hover:bg-white/35'
                : 'bg-forsion-600 text-white hover:bg-forsion-500'
            }`}
          >
            Allow Access
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthorizationDialog;
