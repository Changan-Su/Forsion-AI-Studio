import React, { useState, useEffect } from 'react';
import { X, Save, Lock, User, Monitor, Key, Shield, Plus, Trash2, Box, Command } from 'lucide-react';
import { AppSettings, UserRole, AIModel } from '../types';
import { BUILTIN_MODELS } from '../constants';
import { changePassword } from '../services/authService';
import { backendService } from '../services/backendService';

interface SettingsModalProps {
  onClose: () => void;
  userRole: UserRole;
  username: string;
  currentTheme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  currentPreset: 'default' | 'notion';
  onPresetChange: (preset: 'default' | 'notion') => void;
  onModelsChange: () => void; // Callback to refresh app models
}

type TabType = 'general' | 'account' | 'models';

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  onClose, 
  userRole, 
  username, 
  currentTheme,
  onThemeChange,
  currentPreset,
  onPresetChange,
  onModelsChange
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [configs, setConfigs] = useState<AppSettings['externalApiConfigs']>({});
  const [customModels, setCustomModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // New Model Form State
  const [newModelName, setNewModelName] = useState('');
  const [newApiModelId, setNewApiModelId] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  
  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const settings = await backendService.getSettings();
        setConfigs(settings.externalApiConfigs || {});
        setCustomModels(settings.customModels || []);
      } catch (e) {
        console.error("Failed to load settings in modal", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const saveToBackend = async (newConfigs = configs, newCustomModels = customModels) => {
    // We only send the partial updates we care about here
    await backendService.updateSettings({
      externalApiConfigs: newConfigs,
      customModels: newCustomModels
    });
  };

  const handleSaveApiKeys = async () => {
    await saveToBackend(configs, customModels);
    alert('API configurations saved to backend.');
  };

  const handleAddCustomModel = async () => {
    if (!newModelName || !newApiModelId || !newApiKey) {
      alert("Name, Model ID (API), and API Key are required.");
      return;
    }

    const uniqueId = `custom-${Date.now()}`;
    const newConfigKey = `custom-${Date.now()}`; 
    
    const newModel: AIModel = {
      id: uniqueId,
      name: newModelName,
      provider: 'external',
      description: 'Custom added model',
      icon: 'Box',
      apiModelId: newApiModelId,
      configKey: newConfigKey,
      isCustom: true,
      defaultBaseUrl: newBaseUrl
    };

    const updatedConfigs = {
      ...configs,
      [newConfigKey]: {
        apiKey: newApiKey,
        baseUrl: newBaseUrl || undefined
      }
    };

    const updatedModels = [...customModels, newModel];
    
    setCustomModels(updatedModels);
    setConfigs(updatedConfigs);
    
    await saveToBackend(updatedConfigs, updatedModels);
    onModelsChange();

    // Reset Form
    setNewModelName('');
    setNewApiModelId('');
    setNewApiKey('');
    setNewBaseUrl('');
    alert('Model added successfully!');
  };

  const handleDeleteModel = async (modelId: string, configKey?: string) => {
    if(!confirm("Delete this model?")) return;
    
    const updatedModels = customModels.filter(m => m.id !== modelId);
    const updatedConfigs = { ...configs };
    if (configKey && updatedConfigs[configKey]) {
      delete updatedConfigs[configKey];
    }

    setCustomModels(updatedModels);
    setConfigs(updatedConfigs);
    
    await saveToBackend(updatedConfigs, updatedModels);
    onModelsChange();
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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'Passwords do not match', type: 'error' });
      return;
    }
    if (newPassword.length < 4) {
      setPasswordMsg({ text: 'Password too short', type: 'error' });
      return;
    }
    
    const success = await changePassword(username, newPassword);
    if (success) {
      setPasswordMsg({ text: 'Password updated successfully', type: 'success' });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordMsg({ text: 'Failed to update password', type: 'error' });
    }
  };

  // Built-in Providers
  const builtinProviders = Array.from(new Set(BUILTIN_MODELS.map(m => m.configKey || m.id)));

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-white">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:text-dark-muted dark:hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-56 bg-gray-50 dark:bg-zinc-900/30 border-r border-gray-200 dark:border-dark-border p-4 space-y-2 flex-shrink-0">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'general' 
                  ? 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                  : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Monitor size={18} />
              General
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'account' 
                  ? 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                  : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              <User size={18} />
              Account
            </button>
            {userRole === UserRole.ADMIN && (
              <button
                onClick={() => setActiveTab('models')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'models' 
                    ? 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                    : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Box size={18} />
                Models (Admin)
              </button>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-dark-bg">
            
            {/* --- GENERAL TAB --- */}
            {activeTab === 'general' && (
              <div className="space-y-8">
                {/* Theme Mode */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Appearance</h3>
                  <div className="flex gap-4">
                    <button
                      onClick={() => onThemeChange('light')}
                      className={`flex-1 p-4 border rounded-xl flex flex-col items-center gap-3 transition-all ${
                        currentTheme === 'light'
                          ? 'border-forsion-500 bg-forsion-50 dark:bg-forsion-900/10 ring-2 ring-forsion-500/20'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center"><Monitor size={16}/></div>
                      <span className="font-medium text-gray-900 dark:text-dark-text">Light Mode</span>
                    </button>
                    
                    <button
                      onClick={() => onThemeChange('dark')}
                      className={`flex-1 p-4 border rounded-xl flex flex-col items-center gap-3 transition-all ${
                        currentTheme === 'dark'
                          ? 'border-forsion-500 bg-forsion-50 dark:bg-forsion-900/10 ring-2 ring-forsion-500/20'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center"><Monitor size={16}/></div>
                      <span className="font-medium text-gray-900 dark:text-dark-text">Dark Mode</span>
                    </button>
                  </div>
                </div>

                {/* Theme Preset */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Theme Style</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => onPresetChange('default')}
                      className={`p-4 border rounded-xl text-left transition-all ${
                        currentPreset === 'default'
                          ? 'border-forsion-500 bg-forsion-50 dark:bg-forsion-900/10 ring-2 ring-forsion-500/20'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-forsion-600 to-indigo-600 mb-1">Cyber Tech</div>
                      <div className="text-xs text-gray-500 dark:text-dark-muted">Vibrant gradients, modern sans-serif.</div>
                    </button>

                    <button
                      onClick={() => onPresetChange('notion')}
                      className={`p-4 border rounded-xl text-left transition-all ${
                        currentPreset === 'notion'
                          ? 'border-gray-900 dark:border-white bg-gray-100 dark:bg-zinc-800 ring-1 ring-gray-900 dark:ring-white'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="font-bold font-serif text-gray-900 dark:text-white mb-1">Notion Style</div>
                      <div className="text-xs text-gray-500 dark:text-dark-muted">Minimalist, monochrome, serif fonts.</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- ACCOUNT TAB --- */}
            {activeTab === 'account' && (
              <div className="max-w-md">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Change Password</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-forsion-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-forsion-500" />
                  </div>
                  {passwordMsg.text && (
                    <div className={`text-sm ${passwordMsg.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                      {passwordMsg.text}
                    </div>
                  )}
                  <button type="submit" className="bg-forsion-600 hover:bg-forsion-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                    Update Password
                  </button>
                </form>
              </div>
            )}

            {/* --- MODELS TAB (ADMIN) --- */}
            {activeTab === 'models' && userRole === UserRole.ADMIN && (
              <div className="space-y-10">
                
                {/* 1. Add Custom Model Section */}
                <div className="bg-gray-50 dark:bg-zinc-900/40 p-6 rounded-xl border border-gray-200 dark:border-dark-border">
                  <div className="flex items-center gap-2 mb-4 text-forsion-600 dark:text-forsion-400">
                    <Plus size={20} />
                    <h3 className="text-lg font-bold">Add Custom Model</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Display Name</label>
                      <input type="text" value={newModelName} onChange={e => setNewModelName(e.target.value)} placeholder="My Llama 3" className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">API Model ID</label>
                      <input type="text" value={newApiModelId} onChange={e => setNewApiModelId(e.target.value)} placeholder="llama-3-70b" className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Base URL</label>
                      <input type="text" value={newBaseUrl} onChange={e => setNewBaseUrl(e.target.value)} placeholder="https://api.groq.com/openai/v1" className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">API Key</label>
                      <input type="password" value={newApiKey} onChange={e => setNewApiKey(e.target.value)} placeholder="sk-..." className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={handleAddCustomModel} className="bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity">
                      Add Model
                    </button>
                  </div>
                </div>

                {/* 2. Custom Models List */}
                {customModels.length > 0 && (
                  <div>
                    <h3 className="text-md font-bold text-gray-900 dark:text-white mb-3">Your Custom Models</h3>
                    <div className="space-y-3">
                      {customModels.map(model => (
                        <div key={model.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-dark-border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Box size={18} className="text-forsion-500" />
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white text-sm">{model.name}</div>
                              <div className="text-xs text-gray-500 dark:text-dark-muted font-mono">{model.apiModelId} • {model.defaultBaseUrl}</div>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteModel(model.id, model.configKey)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-md transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Built-in Configurations */}
                <div>
                   <h3 className="text-md font-bold text-gray-900 dark:text-white mb-3">Built-in Providers</h3>
                   <div className="space-y-4">
                      {builtinProviders.map(providerKey => {
                        const representativeModel = BUILTIN_MODELS.find(m => (m.configKey || m.id) === providerKey);
                        const providerName = providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
                        
                        return (
                          <div key={providerKey} className="bg-gray-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-gray-200 dark:border-dark-border">
                             <div className="flex items-center justify-between mb-3">
                               <span className="font-semibold text-sm text-gray-900 dark:text-white">{providerName}</span>
                               <span className="text-[10px] bg-gray-200 dark:bg-zinc-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-mono">{providerKey}</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-gray-400 dark:text-dark-muted uppercase mb-1">API Key</label>
                                  <input type="password" value={configs[providerKey]?.apiKey || ''} onChange={(e) => updateConfig(providerKey, 'apiKey', e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded px-2 py-1.5 text-xs text-gray-900 dark:text-white" placeholder="Default used" />
                                </div>
                                {representativeModel?.provider === 'external' && (
                                   <div>
                                     <label className="block text-[10px] font-bold text-gray-400 dark:text-dark-muted uppercase mb-1">Base URL</label>
                                     <input type="text" value={configs[providerKey]?.baseUrl || ''} onChange={(e) => updateConfig(providerKey, 'baseUrl', e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded px-2 py-1.5 text-xs text-gray-900 dark:text-white" placeholder="Default used" />
                                   </div>
                                )}
                             </div>
                          </div>
                        )
                      })}
                      
                      <div className="flex justify-end">
                        <button onClick={handleSaveApiKeys} className="flex items-center gap-2 bg-forsion-600 hover:bg-forsion-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                          <Save size={16} /> Save Built-in Configs
                        </button>
                      </div>
                   </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;