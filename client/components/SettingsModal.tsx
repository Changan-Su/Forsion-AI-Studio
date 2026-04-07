import React, { useState, useEffect, useRef } from 'react';
import { X, Save, User, Monitor, Code, ToggleLeft, ToggleRight, Plus, Trash2, Box, Puzzle, Bot, Brain, RefreshCw, Globe, Code2, Zap, Wrench, CheckCircle2, XCircle, Loader2, Download, Upload } from 'lucide-react';
import { AppSettings, UserRole, AIModel, AgentDefaults, McpServerConfig, SkillDefinition, CustomSkillDefinition } from '../types';
import { BUILTIN_MODELS, DEFAULT_MODEL_ID } from '../constants';
import { changePassword } from '../services/authService';
import { backendService } from '../services/backendService';
import { getAllBuiltinSkills } from '../services/skillsRegistry';
import { readMemory, writeMemory, downloadMemoryFile, importMemoryFile } from '../services/memoryService';
import SkillsMarket from './SkillsMarket';
import { AnimatedModalBackdrop, AnimatedModalContent } from './AnimatedUI';

interface SettingsModalProps {
  onClose: () => void;
  userRole: UserRole;
  user: import('../types').User; // User object with nickname and avatar
  currentTheme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  currentPreset: string;
  onPresetChange: (preset: string) => void;
  currentSessionId?: string;
  onModelsChange: () => void; // Callback to refresh app models
  onUpdateSettings: (settings: Partial<import('../types').AppSettings>) => Promise<void>; // Update settings function
  isOffline: boolean;
  onReconnect: () => Promise<boolean>;
}

type TabType = 'general' | 'agent' | 'skills';

const SKILL_ICONS: Record<string, React.ElementType> = { Globe, Code2, Zap, Wrench, Brain };

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  onClose, 
  userRole, 
  user,
  currentTheme,
  onThemeChange,
  currentPreset,
  onPresetChange,
  onModelsChange,
  onUpdateSettings,
  isOffline,
  onReconnect,
  currentSessionId
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

  // Agent Defaults State
  const [agentSystemPrompt, setAgentSystemPrompt] = useState('');
  const [agentMaxIterations, setAgentMaxIterations] = useState(10);
  const [agentEnabledSkillIds, setAgentEnabledSkillIds] = useState<string[]>([]);
  const [agentMcpServers, setAgentMcpServers] = useState<McpServerConfig[]>([]);
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [agentChanged, setAgentChanged] = useState(false);
  const builtinSkills = getAllBuiltinSkills();

  // Memory State
  const [memoryText, setMemoryText] = useState('');
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [memoryDirty, setMemoryDirty] = useState(false);
  const memoryFileRef = useRef<HTMLInputElement>(null);

  const loadMemory = async () => {
    setLoadingMemory(true);
    try {
      const text = await readMemory();
      setMemoryText(text);
      setMemoryLoaded(true);
      setMemoryDirty(false);
    } catch (e) {
      console.warn('[SettingsModal] Failed to load memory:', e);
    } finally {
      setLoadingMemory(false);
    }
  };

  useEffect(() => {
    if (showMemory && !memoryLoaded && !loadingMemory) {
      loadMemory();
    }
  }, [showMemory]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const settings = await backendService.getSettings();
        const loadedCustomModels = settings.customModels || [];
        setConfigs(settings.externalApiConfigs || {});
        setCustomModels(loadedCustomModels);
        setDeveloperMode(settings.developerMode || false);
        // Load agent defaults
        const ad = settings.agentDefaults;
        if (ad) {
          setAgentSystemPrompt(ad.systemPrompt || '');
          setAgentMaxIterations(ad.maxIterations || 10);
          setAgentEnabledSkillIds(ad.enabledSkillIds || []);
          setAgentMcpServers((ad.mcpServers || []).map((s: any) => ({ ...s, status: 'disconnected' as const })));
        }
        setAgentChanged(false);
        // Load nickname and avatar from user prop or settings
        setNickname(user.nickname || settings.nickname || '');
        setAvatarData(user.avatar || settings.avatar || null);
        setProfileChanged(false);
      } catch (e) {
        console.error("Failed to load settings in modal", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [userRole, user.id, user.nickname, user.avatar]);

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
    
    const success = await changePassword(user.username, newPassword);
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
      await onUpdateSettings({
        nickname: nickname.trim() || null,
        avatar: avatarData || null
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
      <AnimatedModalBackdrop className="bg-black/50 backdrop-blur-sm">
        <div className="text-white">Loading settings...</div>
      </AnimatedModalBackdrop>
    );
  }

  return (
    <AnimatedModalBackdrop onClose={onClose} className="bg-black/50 backdrop-blur-sm">
      <AnimatedModalContent className={`w-full max-w-4xl shadow-2xl flex flex-col h-[90vh] overflow-hidden rounded-[var(--radius-xl)] ${
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
              onClick={() => setActiveTab('skills')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'skills' 
                  ? isMonet ? 'bg-white/20 text-white shadow-sm' : 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                  : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Puzzle size={18} />
              Skills
            </button>
            <button
              onClick={() => setActiveTab('agent')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'agent' 
                  ? isMonet ? 'bg-white/20 text-white shadow-sm' : 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                  : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Bot size={18} />
              Agent
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => onPresetChange('default')}
                      className={`p-4 border rounded-xl text-left transition-all ${
                        currentPreset === 'default'
                          ? 'border-forsion-500 bg-forsion-50 dark:bg-forsion-900/10 ring-2 ring-forsion-500/20'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-forsion-600 to-indigo-600 mb-1">Cyber Tech</div>
                      <div className="text-xs text-gray-500 dark:text-dark-muted">Vibrant gradients, modern feel.</div>
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
                      <div className="text-xs text-gray-500 dark:text-dark-muted">Minimalist, monochrome, serif.</div>
                    </button>

                    <button
                      onClick={() => onPresetChange('monet')}
                      className={`p-4 border rounded-xl text-left transition-all ${
                        currentPreset === 'monet'
                          ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 ring-2 ring-purple-400/30'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="font-bold font-cursive text-purple-700 dark:text-purple-300 mb-1 text-lg">Monet 2.0</div>
                      <div className="text-xs text-gray-500 dark:text-dark-muted">Watercolor, glassmorphism.</div>
                    </button>

                    <button
                      onClick={() => onPresetChange('apple')}
                      className={`p-4 border rounded-xl text-left transition-all ${
                        currentPreset === 'apple'
                          ? 'border-blue-400 bg-gray-50 dark:bg-zinc-800 ring-2 ring-blue-400/20'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="font-bold text-gray-800 dark:text-white mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>Apple Glass</div>
                      <div className="text-xs text-gray-500 dark:text-dark-muted">Frosted glass, colorful icons.</div>
                    </button>

                    <button
                      onClick={() => onPresetChange('forsion1')}
                      className={`p-4 border rounded-xl text-left transition-all ${
                        currentPreset === 'forsion1'
                          ? 'border-amber-400 ring-2 ring-amber-400/20'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                      style={currentPreset === 'forsion1' ? { background: '#f5f0ea' } : undefined}
                    >
                      <div className="font-bold mb-1" style={{ color: '#8e8578' }}>Forsion Theme 1</div>
                      <div className="text-xs text-gray-500 dark:text-dark-muted">Morandi colors, warm glass.</div>
                    </button>

                    <button
                      onClick={() => onPresetChange('qbird')}
                      className={`p-4 border rounded-xl text-left transition-all ${
                        currentPreset === 'qbird'
                          ? 'border-cyan-400 bg-[#F5F5F7] dark:bg-[#1C1C1E] ring-2 ring-cyan-400/20'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="font-bold text-cyan-600 dark:text-cyan-400 mb-1">QBird</div>
                      <div className="text-xs text-gray-500 dark:text-dark-muted">Apple HIG, cyan accent.</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- SKILLS TAB --- */}
            {activeTab === 'skills' && (
              <SkillsMarket
                themePreset={currentPreset}
                sessionId={currentSessionId || ''}
              />
            )}

            {/* --- AGENT TAB --- */}
            {activeTab === 'agent' && (
              <div className="space-y-8">
                <div>
                  <h3 className={`text-lg font-medium mb-2 flex items-center gap-2 ${isMonet ? 'text-[#4A4B6A]' : 'text-gray-900 dark:text-white'}`}>
                    <Bot size={20} className={isMonet ? 'text-[#4A4B6A]' : 'text-gray-500'} />
                    Agent Global Defaults
                  </h3>
                  <p className={`text-sm mb-6 ${isMonet ? 'text-[#4A4B6A]/70' : 'text-gray-500 dark:text-dark-muted'}`}>
                    These defaults are applied to all new sessions. Each session can override them individually.
                  </p>
                </div>

                {/* Default System Prompt */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isMonet ? 'text-[#4A4B6A]' : 'text-gray-700 dark:text-gray-300'}`}>
                    Default System Prompt
                  </label>
                  <textarea
                    value={agentSystemPrompt}
                    onChange={(e) => { setAgentSystemPrompt(e.target.value); setAgentChanged(true); }}
                    placeholder="Default instructions for the agent across all sessions…"
                    rows={3}
                    className={`w-full px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-forsion-500 resize-none ${
                      isMonet
                        ? 'bg-white/30 border border-white/30 text-[#4A4B6A] placeholder-[#4A4B6A]/50'
                        : 'bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-dark-border text-gray-900 dark:text-white'
                    }`}
                  />
                </div>

                {/* Default Max Iterations */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-sm font-medium ${isMonet ? 'text-[#4A4B6A]' : 'text-gray-700 dark:text-gray-300'}`}>
                      Default Max Iterations
                    </label>
                    <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{agentMaxIterations}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={agentMaxIterations}
                    onChange={(e) => { setAgentMaxIterations(parseInt(e.target.value)); setAgentChanged(true); }}
                    className="w-full accent-forsion-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>1</span>
                    <span>20</span>
                  </div>
                </div>

                {/* Default Skills */}
                <div>
                  <label className={`block text-sm font-medium mb-3 ${isMonet ? 'text-[#4A4B6A]' : 'text-gray-700 dark:text-gray-300'}`}>
                    Default Skills
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {builtinSkills.map((skill) => {
                      const enabled = agentEnabledSkillIds.includes(skill.id);
                      const Icon = SKILL_ICONS[skill.icon] ?? Wrench;
                      return (
                        <button
                          key={skill.id}
                          onClick={() => {
                            setAgentEnabledSkillIds(prev =>
                              prev.includes(skill.id) ? prev.filter(id => id !== skill.id) : [...prev, skill.id]
                            );
                            setAgentChanged(true);
                          }}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-all ${
                            enabled
                              ? isMonet
                                ? 'border-[#4A4B6A] bg-[#4A4B6A]/10 text-[#4A4B6A]'
                                : 'border-forsion-500 bg-forsion-50 dark:bg-forsion-900/20 text-forsion-700 dark:text-forsion-400'
                              : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <Icon size={16} />
                          <span className="font-medium">{skill.name}</span>
                          <span className="opacity-60 text-[10px] text-center leading-tight">{skill.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Default MCP Servers */}
                <div>
                  <label className={`block text-sm font-medium mb-3 ${isMonet ? 'text-[#4A4B6A]' : 'text-gray-700 dark:text-gray-300'}`}>
                    Default MCP Servers
                  </label>
                  <div className="space-y-2 mb-3">
                    {agentMcpServers.map((server) => (
                      <div
                        key={server.id}
                        className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                          isMonet ? 'border-white/30 bg-white/20' : 'border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-zinc-900'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">{server.name}</div>
                          <div className="text-xs text-gray-500 dark:text-dark-muted truncate">{server.url}</div>
                        </div>
                        <button
                          onClick={() => {
                            setAgentMcpServers(prev => prev.filter(s => s.id !== server.id));
                            setAgentChanged(true);
                          }}
                          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-md transition-colors ml-2"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newMcpName}
                      onChange={(e) => setNewMcpName(e.target.value)}
                      placeholder="Server name"
                      className={`flex-shrink-0 w-32 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forsion-500 ${
                        isMonet
                          ? 'bg-white/30 border border-white/30 text-[#4A4B6A]'
                          : 'bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-dark-border text-gray-900 dark:text-white'
                      }`}
                    />
                    <input
                      value={newMcpUrl}
                      onChange={(e) => setNewMcpUrl(e.target.value)}
                      placeholder="https://… (SSE endpoint)"
                      className={`flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-forsion-500 ${
                        isMonet
                          ? 'bg-white/30 border border-white/30 text-[#4A4B6A]'
                          : 'bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-dark-border text-gray-900 dark:text-white'
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newMcpName.trim() && newMcpUrl.trim()) {
                          setAgentMcpServers(prev => [...prev, {
                            id: `mcp_${Date.now()}`, name: newMcpName.trim(), url: newMcpUrl.trim(),
                            enabled: true, status: 'disconnected' as const,
                          }]);
                          setNewMcpName(''); setNewMcpUrl(''); setAgentChanged(true);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!newMcpName.trim() || !newMcpUrl.trim()) return;
                        setAgentMcpServers(prev => [...prev, {
                          id: `mcp_${Date.now()}`, name: newMcpName.trim(), url: newMcpUrl.trim(),
                          enabled: true, status: 'disconnected' as const,
                        }]);
                        setNewMcpName(''); setNewMcpUrl(''); setAgentChanged(true);
                      }}
                      disabled={!newMcpName.trim() || !newMcpUrl.trim()}
                      className={`px-3 py-2 rounded-lg transition-colors disabled:opacity-30 ${
                        isMonet
                          ? 'bg-[#4A4B6A] hover:bg-[#3E406F] text-white'
                          : 'bg-forsion-600 hover:bg-forsion-500 text-white'
                      }`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Memory */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className={`text-sm font-medium ${isMonet ? 'text-[#4A4B6A]' : 'text-gray-700 dark:text-gray-300'}`}>
                      Memory
                    </label>
                    <button
                      onClick={() => setShowMemory(prev => !prev)}
                      className={`text-xs px-2 py-1 rounded-md transition-colors ${
                        isMonet ? 'text-[#4A4B6A]/70 hover:bg-white/20' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {showMemory ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className={`text-xs mb-3 ${isMonet ? 'text-[#4A4B6A]/60' : 'text-gray-400 dark:text-gray-500'}`}>
                    A shared Markdown note the agent reads and writes. Enable Memory skill to let the agent auto-save context.
                  </p>

                  {showMemory && (
                    <div className="space-y-3">
                      {/* Toolbar */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadMemoryFile(memoryText)}
                          disabled={!memoryText}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-30 ${
                            isMonet ? 'border-white/30 hover:bg-white/20 text-[#4A4B6A]' : 'border-gray-200 dark:border-dark-border hover:bg-gray-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <Download size={13} /> Export
                        </button>
                        <button
                          onClick={() => memoryFileRef.current?.click()}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            isMonet ? 'border-white/30 hover:bg-white/20 text-[#4A4B6A]' : 'border-gray-200 dark:border-dark-border hover:bg-gray-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <Upload size={13} /> Import
                        </button>
                        <input
                          ref={memoryFileRef}
                          type="file"
                          accept=".md,.txt,text/markdown,text/plain"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const text = await importMemoryFile(file);
                                setMemoryText(text);
                                setMemoryDirty(false);
                              } catch (err) {
                                console.error('[Memory] Import failed:', err);
                              }
                            }
                            if (memoryFileRef.current) memoryFileRef.current.value = '';
                          }}
                        />
                        <button
                          onClick={loadMemory}
                          disabled={loadingMemory}
                          className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ml-auto ${
                            isMonet ? 'border-white/30 hover:bg-white/20' : 'border-gray-200 dark:border-dark-border hover:bg-gray-100 dark:hover:bg-zinc-800'
                          }`}
                          title="Reload from server"
                        >
                          <RefreshCw size={13} className={loadingMemory ? 'animate-spin' : ''} />
                        </button>
                      </div>

                      {/* Editor */}
                      {loadingMemory ? (
                        <p className="text-xs text-gray-400 flex items-center gap-1.5 py-3">
                          <Loader2 size={13} className="animate-spin" /> Loading memory…
                        </p>
                      ) : (
                        <>
                          <textarea
                            value={memoryText}
                            onChange={(e) => { setMemoryText(e.target.value); setMemoryDirty(true); }}
                            placeholder="Memory is empty. The agent will write here when Memory skill is enabled, or you can type directly."
                            rows={8}
                            className={`w-full px-3 py-2.5 rounded-lg text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-forsion-500 resize-y ${
                              isMonet
                                ? 'bg-white/30 border border-white/30 text-[#4A4B6A] placeholder-[#4A4B6A]/40'
                                : 'bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-dark-border text-gray-900 dark:text-white placeholder-gray-400'
                            }`}
                          />
                          {memoryDirty && (
                            <button
                              onClick={async () => {
                                try {
                                  await writeMemory(memoryText);
                                  setMemoryDirty(false);
                                } catch (err) {
                                  console.error('[Memory] Save failed:', err);
                                }
                              }}
                              className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium transition-colors ${
                                isMonet
                                  ? 'bg-[#4A4B6A] hover:bg-[#3E406F] text-white'
                                  : 'bg-forsion-600 hover:bg-forsion-500 text-white'
                              }`}
                            >
                              <Save size={13} /> Save Memory
                            </button>
                          )}
                          <p className={`text-[10px] ${isMonet ? 'text-[#4A4B6A]/40' : 'text-gray-400 dark:text-gray-600'}`}>
                            {memoryText.length} chars — synced across devices
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Save Agent Defaults */}
                {agentChanged && (
                  <div>
                    <button
                      onClick={async () => {
                        try {
                          const agentDefaults: AgentDefaults = {
                            systemPrompt: agentSystemPrompt,
                            maxIterations: agentMaxIterations,
                            enabledSkillIds: agentEnabledSkillIds,
                            mcpServers: agentMcpServers.map(s => ({
                              ...s,
                              status: 'disconnected' as const,
                              discoveredTools: undefined,
                              lastConnectedAt: undefined,
                              errorMessage: undefined,
                            })),
                          };
                          await onUpdateSettings({ agentDefaults });
                          setAgentChanged(false);
                          alert('Agent defaults saved successfully!');
                          onModelsChange();
                        } catch (error) {
                          console.error('Failed to save agent defaults:', error);
                          alert('Failed to save agent defaults. Please try again.');
                        }
                      }}
                      className={`px-6 py-2.5 rounded-lg font-medium transition-all hover:shadow-lg ${
                        isMonet
                          ? 'bg-[#4A4B6A] hover:bg-[#3E406F] text-white'
                          : 'bg-forsion-600 hover:bg-forsion-500 text-white'
                      }`}
                    >
                      <Save size={16} className="inline mr-2" />
                      Save Agent Defaults
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* --- ACCOUNT TAB --- */}

          </div>
        </div>
      </AnimatedModalContent>
    </AnimatedModalBackdrop>
  );
};

export default SettingsModal;
