import React, { useState, useEffect } from 'react';
import { X, Save, User, Monitor, Code, ToggleLeft, ToggleRight, Plus, Trash2, Box } from 'lucide-react';
import { AppSettings, UserRole, AIModel } from '../types';
import { BUILTIN_MODELS, DEFAULT_MODEL_ID } from '../constants';
import { changePassword } from '../services/authService';
import { backendService } from '../services/backendService';

interface SettingsModalProps {
  onClose: () => void;
  userRole: UserRole;
  username: string;
  currentTheme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  currentPreset: 'default' | 'notion' | 'monet';
  onPresetChange: (preset: 'default' | 'notion' | 'monet') => void;
  onModelsChange: () => void; // Callback to refresh app models
  isOffline: boolean;
  onReconnect: () => Promise<boolean>;
}

type TabType = 'general' | 'account' | 'developer';

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  onClose, 
  userRole, 
  username, 
  currentTheme,
  onThemeChange,
  currentPreset,
  onPresetChange,
  onModelsChange,
  isOffline,
  onReconnect
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [configs, setConfigs] = useState<AppSettings['externalApiConfigs']>({});
  const [customModels, setCustomModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);
  
  // User Profile State
  const [nickname, setNickname] = useState('');
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [profileChanged, setProfileChanged] = useState(false);
  
  // New Model Form State
  const [newModelName, setNewModelName] = useState('');
  const [newApiModelId, setNewApiModelId] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  
  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });
  const [reconnectStatus, setReconnectStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const settings = await backendService.getSettings();
        const loadedCustomModels = settings.customModels || [];
        setConfigs(settings.externalApiConfigs || {});
        setCustomModels(loadedCustomModels);
        setDeveloperMode(settings.developerMode || false);
        setNickname(settings.nickname || '');
        setAvatarData(settings.avatar || null);
      } catch (e) {
        console.error("Failed to load settings in modal", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [userRole]);

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
    onModelsChange();
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

  useEffect(() => {
    if (!isOffline && reconnectStatus === 'success') {
      const timer = setTimeout(() => setReconnectStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
    if (!isOffline && reconnectStatus === 'error') {
      const timer = setTimeout(() => setReconnectStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, reconnectStatus]);

  const handleReconnect = async () => {
    setReconnectStatus('loading');
    try {
      const ok = await onReconnect();
      setReconnectStatus(ok ? 'success' : 'error');
    } catch (error) {
      console.error('Reconnect failed', error);
      setReconnectStatus('error');
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (2MB limit)
      const maxSize = 2 * 1024 * 1024; // 2MB in bytes
      if (file.size > maxSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        alert(`Avatar image is too large (${fileSizeMB}MB). Maximum size is 2MB.`);
        // Reset file input
        e.target.value = '';
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPG, PNG, GIF, etc.)');
        e.target.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarData(event.target.result as string);
          setProfileChanged(true);
        }
      };
      reader.onerror = () => {
        alert('Failed to read image file. Please try again.');
        e.target.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await backendService.updateSettings({
        nickname: nickname.trim() || null,
        avatar: avatarData
      });
      alert('Profile saved successfully!');
      setProfileChanged(false);
      onModelsChange(); // Trigger app state refresh
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  const isMonet = currentPreset === 'monet';

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-white">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-4xl shadow-2xl flex flex-col h-[90vh] overflow-hidden rounded-[32px] ${
        isMonet 
          ? 'glass-dark' 
          : 'bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border'
      }`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isMonet
            ? 'border-white/10 bg-transparent'
            : 'border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-zinc-900/50'
        }`}>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:text-dark-muted dark:hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className={`w-56 p-4 space-y-2 flex-shrink-0 border-r ${
            isMonet
              ? 'border-white/10 bg-white/5'
              : 'bg-gray-50 dark:bg-zinc-900/30 border-gray-200 dark:border-dark-border'
          }`}>
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'general' 
                  ? isMonet ? 'bg-white/20 text-white shadow-sm' : 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
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
                  ? isMonet ? 'bg-white/20 text-white shadow-sm' : 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                  : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              <User size={18} />
              Account
            </button>
            <button
              onClick={() => setActiveTab('developer')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'developer' 
                  ? isMonet ? 'bg-white/20 text-white shadow-sm' : 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                  : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Code size={18} />
              Developer
            </button>
          </div>

          {/* Content Area */}
          <div className={`flex-1 overflow-y-auto p-6 ${
            isMonet ? 'bg-transparent' : 'bg-white dark:bg-dark-bg'
          }`}>
            <div className={`mb-6 rounded-xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm font-medium ${
              isOffline
                ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-400/30 dark:text-amber-100'
                : reconnectStatus === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-100'
                  : reconnectStatus === 'error'
                    ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-400/30 dark:text-red-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-500/10 dark:border-slate-400/30 dark:text-slate-100'
            }`}>
              <div>
                {isOffline ? (
                  <>
                    <p>当前正使用离线模式，所有修改仅保存在浏览器本地，其他设备无法获取。</p>
                    <p className="text-xs opacity-80 mt-1">请先重新连接服务器再保存重要配置。</p>
                  </>
                ) : reconnectStatus === 'success' ? (
                  <p>已成功重新连接服务器并同步配置。</p>
                ) : reconnectStatus === 'error' ? (
                  <p>重新连接失败，请检查网络或后台服务。</p>
                ) : (
                  <p>当前已连接服务器（在线模式）。如出现异常可随时重新尝试连接。</p>
                )}
              </div>
              <button
                onClick={handleReconnect}
                disabled={reconnectStatus === 'loading'}
                className={`px-4 py-2 rounded-lg text-xs font-semibold shadow transition-colors ${
                  isOffline ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-300'
                } disabled:opacity-70`}
              >
                {reconnectStatus === 'loading' ? '正在尝试…' : '重新连接服务器'}
              </button>
            </div>
            
            {/* --- GENERAL TAB --- */}
            {activeTab === 'general' && (
              <div className="space-y-8">
                {/* User Profile */}
                <div>
                  <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isMonet ? 'text-[#4A4B6A]' : 'text-gray-900 dark:text-white'}`}>
                    <User size={20} className={isMonet ? 'text-[#4A4B6A]' : 'text-gray-500'} />
                    User Profile
                  </h3>
                  <div className="space-y-4">
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={`w-20 h-20 rounded-full overflow-hidden border-2 ${isMonet ? 'border-white/30' : 'border-gray-300 dark:border-dark-border'}`}>
                          {avatarData ? (
                            <img src={avatarData} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center font-bold text-2xl ${isMonet ? 'bg-white/20 text-[#4A4B6A]' : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'}`}>
                              {username.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          id="avatar-upload"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </div>
                      <div className="flex-1">
                        <label
                          htmlFor="avatar-upload"
                          className={`inline-block px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                            isMonet
                              ? 'bg-white/30 hover:bg-white/40 text-[#4A4B6A] border border-white/30'
                              : 'bg-forsion-100 hover:bg-forsion-200 text-forsion-700 dark:bg-forsion-900/20 dark:hover:bg-forsion-900/30 dark:text-forsion-400'
                          }`}
                        >
                          Upload Avatar
                        </label>
                        <p className={`text-xs mt-1 ${isMonet ? 'text-[#4A4B6A]/70' : 'text-gray-500 dark:text-dark-muted'}`}>
                          Max size: 2MB, formats: JPG, PNG, GIF
                        </p>
                      </div>
                    </div>

                    {/* Nickname */}
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${isMonet ? 'text-[#4A4B6A]' : 'text-gray-700 dark:text-gray-300'}`}>
                        Nickname (optional)
                      </label>
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => {
                          setNickname(e.target.value);
                          setProfileChanged(true);
                        }}
                        placeholder={username}
                        className={`w-full max-w-md px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-forsion-500 ${
                          isMonet
                            ? 'bg-white/30 border border-white/30 text-[#4A4B6A] placeholder-[#4A4B6A]/50'
                            : 'bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-dark-border text-gray-900 dark:text-white'
                        }`}
                      />
                      <p className={`text-xs mt-1 ${isMonet ? 'text-[#4A4B6A]/70' : 'text-gray-500 dark:text-dark-muted'}`}>
                        Will be displayed instead of username if set
                      </p>
                    </div>

                    {/* Save Button */}
                    {profileChanged && (
                      <div>
                        <button
                          onClick={handleSaveProfile}
                          className={`px-6 py-2.5 rounded-lg font-medium transition-all hover:shadow-lg ${
                            isMonet
                              ? 'bg-[#4A4B6A] hover:bg-[#3E406F] text-white'
                              : 'bg-forsion-600 hover:bg-forsion-500 text-white'
                          }`}
                        >
                          <Save size={16} className="inline mr-2" />
                          Save Profile
                        </button>
                      </div>
                    )}
                  </div>
                </div>

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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                    <button
                      onClick={() => onPresetChange('monet')}
                      className={`p-4 border rounded-xl text-left transition-all ${
                        currentPreset === 'monet'
                          ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 ring-2 ring-purple-400/30'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="font-bold font-cursive text-purple-700 dark:text-purple-300 mb-1 text-lg">Monet Cliffs</div>
                      <div className="text-xs text-gray-500 dark:text-dark-muted">Impressionist colors, glassmorphism, soft gradients.</div>
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

            {/* --- DEVELOPER TAB --- */}
            {activeTab === 'developer' && (
              <div className="space-y-8">
                {/* Developer Mode Toggle */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Code size={24} className="text-purple-600 dark:text-purple-400" />
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Developer Mode</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Enable advanced features for adding custom models</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const newValue = !developerMode;
                        setDeveloperMode(newValue);
                        await backendService.updateSettings({ developerMode: newValue });
                      }}
                      className="p-2 rounded-lg transition-colors"
                    >
                      {developerMode ? (
                        <ToggleRight size={40} className="text-purple-600 dark:text-purple-400" />
                      ) : (
                        <ToggleLeft size={40} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                  {developerMode && (
                    <div className="mt-4 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        ✓ Developer mode enabled. You can now add custom models below.
                      </p>
                    </div>
                  )}
                </div>

                {/* Custom Models Section (Only visible when developer mode is on) */}
                {developerMode && (
                  <>
                    {/* Add Custom Model Section */}
                    <div className="bg-gray-50 dark:bg-zinc-900/40 p-6 rounded-xl border border-gray-200 dark:border-dark-border">
                      <div className="flex items-center gap-2 mb-4 text-forsion-600 dark:text-forsion-400">
                        <Plus size={20} />
                        <h3 className="text-lg font-bold">Add Custom Model</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Display Name</label>
                          <input type="text" value={newModelName} onChange={e => setNewModelName(e.target.value)} placeholder="My Custom Model" className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">API Model ID</label>
                          <input type="text" value={newApiModelId} onChange={e => setNewApiModelId(e.target.value)} placeholder="gpt-4o-mini" className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white font-mono" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Base URL</label>
                          <input type="text" value={newBaseUrl} onChange={e => setNewBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">API Key</label>
                          <input type="password" value={newApiKey} onChange={e => setNewApiKey(e.target.value)} placeholder="sk-..." className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button onClick={handleAddCustomModel} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-opacity">
                          Add Model
                        </button>
                      </div>
                    </div>

                    {/* Custom Models List */}
                    {customModels.length > 0 && (
                      <div>
                        <h3 className="text-md font-bold text-gray-900 dark:text-white mb-3">Your Custom Models</h3>
                        <div className="space-y-3">
                          {customModels.map(model => (
                            <div key={model.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-dark-border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Box size={18} className="text-purple-500" />
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

                    {/* API Configurations */}
                    <div>
                      <h3 className="text-md font-bold text-gray-900 dark:text-white mb-3">API Configurations</h3>
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
                                  <input type="password" value={configs[providerKey]?.apiKey || ''} onChange={(e) => updateConfig(providerKey, 'apiKey', e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded px-2 py-1.5 text-xs text-gray-900 dark:text-white" placeholder="Enter API Key" />
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
                          <button onClick={handleSaveApiKeys} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                            <Save size={16} /> Save Configurations
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!developerMode && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Code size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Enable Developer Mode to add custom models and configure APIs</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
