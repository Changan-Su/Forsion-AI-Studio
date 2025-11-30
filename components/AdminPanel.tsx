import React, { useState, useEffect } from 'react';
import { X, Save, Lock } from 'lucide-react';
import { AppSettings } from '../types';
import { BUILTIN_MODELS, STORAGE_KEYS } from '../constants';

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [configs, setConfigs] = useState<AppSettings['externalApiConfigs']>({});

  useEffect(() => {
    const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (storedSettings) {
      const parsed: AppSettings = JSON.parse(storedSettings);
      setConfigs(parsed.externalApiConfigs || {});
    }
  }, []);

  const handleSave = () => {
    const settings: AppSettings = { externalApiConfigs: configs };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    onClose();
  };

  const updateConfig = (configKey: string, field: 'apiKey' | 'baseUrl', value: string) => {
    setConfigs(prev => {
      const currentConfig = prev[configKey] || { apiKey: '' };
      return {
        ...prev,
        [configKey]: {
          ...currentConfig,
          [field]: value
        }
      };
    });
  };

  // Get unique providers
  const providers = Array.from(new Set(BUILTIN_MODELS.map(m => m.configKey || m.id)));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-900/30 rounded-lg text-red-400">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Admin Configuration</h2>
              <p className="text-sm text-gray-500">Manage API Keys & Endpoints</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-lg text-sm text-blue-200">
             <span className="font-bold block mb-1">Configuration Guide:</span>
             Settings here apply to all models within the same provider group (e.g., setting the 'OpenAI' key works for GPT-4o, Mini, etc).
          </div>

          {providers.map(providerKey => {
            // Find a representative model for this provider to get details
            const representativeModel = BUILTIN_MODELS.find(m => (m.configKey || m.id) === providerKey);
            const providerName = providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
            const defaultBaseUrl = representativeModel?.defaultBaseUrl;
            
            return (
              <div key={providerKey} className="bg-gray-800/50 p-5 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-semibold text-white text-lg">{providerName} Provider</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 font-mono">{providerKey}</span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase mb-1">API Key</label>
                    <input
                      type="password"
                      value={configs[providerKey]?.apiKey || ''}
                      onChange={(e) => updateConfig(providerKey, 'apiKey', e.target.value)}
                      placeholder={`sk-...`}
                      className="w-full bg-gray-900 border border-gray-600 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forsion-500"
                    />
                  </div>
                  
                  {/* Only show Base URL if strictly necessary or if it's not the internal Gemini wrapper (though Gemini supports it in some SDKs, here we use generic GoogleGenAI which handles it differently, usually hardcoded to googleapis. But let's allow it for External ones mostly) */}
                  {representativeModel?.provider === 'external' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Base URL (Optional)</label>
                      <input
                        type="text"
                        value={configs[providerKey]?.baseUrl || ''}
                        onChange={(e) => updateConfig(providerKey, 'baseUrl', e.target.value)}
                        placeholder={defaultBaseUrl || ""}
                        className="w-full bg-gray-900 border border-gray-600 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forsion-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                         Default: <span className="font-mono text-gray-400">{defaultBaseUrl || 'N/A'}</span>. 
                         Ensure it starts with <b>https://</b> and ends with <b>/v1</b> if required.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-900/50 rounded-b-xl flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-forsion-600 hover:bg-forsion-500 text-white px-6 py-2 rounded-lg font-medium transition-all"
          >
            <Save size={18} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;