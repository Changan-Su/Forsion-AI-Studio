import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Lock, User, Monitor, Key, Shield, Plus, Trash2, Box, Command, Code, ToggleLeft, ToggleRight, Ticket, Coins } from 'lucide-react';
import { AppSettings, UserRole, AIModel, User as UserType } from '../types';
import { BUILTIN_MODELS, DEFAULT_MODEL_ID } from '../constants';
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
  isOffline: boolean;
  onReconnect: () => Promise<boolean>;
}

type TabType = 'general' | 'account' | 'developer' | 'models' | 'users' | 'invite-codes' | 'credit-pricing';

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
  const [defaultModelId, setDefaultModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [managedUsers, setManagedUsers] = useState<UserType[]>([]);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: UserRole.USER });
  const [userMessage, setUserMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const [isUserActionLoading, setIsUserActionLoading] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  
  // Invite codes state
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [inviteCodeForm, setInviteCodeForm] = useState({ code: '', max_uses: 1, initial_credits: 0, expires_at: '', notes: '' });
  const [isInviteCodeLoading, setIsInviteCodeLoading] = useState(false);
  
  // Credit pricing state
  const [creditPricing, setCreditPricing] = useState<any[]>([]);
  const [pricingForm, setPricingForm] = useState({ model_id: '', tokens_per_credit: 100, input_multiplier: 1, output_multiplier: 1, provider: '' });
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  
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
        const all = [...BUILTIN_MODELS, ...loadedCustomModels];
        const desiredDefault = settings.defaultModelId && all.some(m => m.id === settings.defaultModelId)
          ? settings.defaultModelId
          : DEFAULT_MODEL_ID;
        setDefaultModelId(desiredDefault);
        
        // Load invite codes and pricing if admin
        if (userRole === UserRole.ADMIN) {
          try {
            const codes = await backendService.listInviteCodes();
            setInviteCodes(codes);
          } catch (e) {
            console.error('Failed to load invite codes', e);
          }
          
          try {
            const pricing = await backendService.listCreditPricing();
            setCreditPricing(pricing);
          } catch (e) {
            console.error('Failed to load credit pricing', e);
          }
        }
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

  const refreshUsers = useCallback(async () => {
    if (userRole !== UserRole.ADMIN) return;
    try {
      const users = await backendService.listUsers();
      setManagedUsers(users);
    } catch (error: any) {
      setUserMessage({ text: error.message || 'Failed to load users', type: 'error' });
    }
  }, [userRole]);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username || !userForm.password) {
      setUserMessage({ text: 'Username and password are required', type: 'error' });
      return;
    }
    setIsUserActionLoading(true);
    try {
      await backendService.createUserAccount(userForm.username, userForm.password, userForm.role as UserRole);
      setUserMessage({ text: 'User created successfully', type: 'success' });
      setUserForm({ username: '', password: '', role: UserRole.USER });
      await refreshUsers();
    } catch (error: any) {
      setUserMessage({ text: error.message || 'Failed to create user', type: 'error' });
    } finally {
      setIsUserActionLoading(false);
    }
  };

  const handleDeleteUserAccount = async (usernameToDelete: string) => {
    if (!window.confirm(`Delete user ${usernameToDelete}?`)) return;
    setIsUserActionLoading(true);
    try {
      await backendService.deleteUserAccount(usernameToDelete);
      setUserMessage({ text: 'User deleted', type: 'success' });
      await refreshUsers();
    } catch (error: any) {
      setUserMessage({ text: error.message || 'Failed to delete user', type: 'error' });
    } finally {
      setIsUserActionLoading(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeForm.code) {
      alert('Code is required');
      return;
    }
    setIsInviteCodeLoading(true);
    try {
      await backendService.createInviteCode(
        inviteCodeForm.code.toUpperCase(),
        inviteCodeForm.max_uses,
        inviteCodeForm.initial_credits,
        inviteCodeForm.expires_at || undefined,
        inviteCodeForm.notes
      );
      setInviteCodeForm({ code: '', max_uses: 1, initial_credits: 0, expires_at: '', notes: '' });
      const codes = await backendService.listInviteCodes();
      setInviteCodes(codes);
      alert('Invite code created successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to create invite code');
    } finally {
      setIsInviteCodeLoading(false);
    }
  };

  const handleDeleteInviteCode = async (id: string) => {
    if (!window.confirm('Delete this invite code?')) return;
    try {
      await backendService.deleteInviteCode(id);
      const codes = await backendService.listInviteCodes();
      setInviteCodes(codes);
    } catch (error: any) {
      alert(error.message || 'Failed to delete invite code');
    }
  };

  const handleSetPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingForm.model_id || !pricingForm.tokens_per_credit) {
      alert('Model ID and tokens per credit are required');
      return;
    }
    setIsPricingLoading(true);
    try {
      await backendService.setCreditPricing(
        pricingForm.model_id,
        pricingForm.tokens_per_credit,
        pricingForm.input_multiplier,
        pricingForm.output_multiplier,
        pricingForm.provider || undefined
      );
      setPricingForm({ model_id: '', tokens_per_credit: 100, input_multiplier: 1, output_multiplier: 1, provider: '' });
      const pricing = await backendService.listCreditPricing();
      setCreditPricing(pricing);
      alert('Pricing set successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to set pricing');
    } finally {
      setIsPricingLoading(false);
    }
  };

  // Built-in Providers
  const builtinProviders = Array.from(new Set(BUILTIN_MODELS.map(m => m.configKey || m.id)));
  const allAvailableModels = [...BUILTIN_MODELS, ...customModels];

  const handleSaveDefaultModel = async () => {
    await backendService.updateSettings({ defaultModelId });
    alert('Default model saved');
    onModelsChange();
  };

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
            <button
              onClick={() => setActiveTab('developer')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'developer' 
                  ? 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                  : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Code size={18} />
              Developer
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
            {userRole === UserRole.ADMIN && (
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'users' 
                    ? 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                    : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Shield size={18} />
                Users (Admin)
              </button>
            )}
            {userRole === UserRole.ADMIN && (
              <button
                onClick={() => setActiveTab('invite-codes')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'invite-codes' 
                    ? 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                    : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Ticket size={18} />
                Invite Codes
              </button>
            )}
            {userRole === UserRole.ADMIN && (
              <button
                onClick={() => setActiveTab('credit-pricing')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'credit-pricing' 
                    ? 'bg-forsion-100 text-forsion-700 dark:bg-forsion-900/20 dark:text-forsion-400' 
                    : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Coins size={18} />
                Credit Pricing
              </button>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-dark-bg">
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

            {/* --- MODELS TAB (ADMIN) --- */}
            {activeTab === 'models' && userRole === UserRole.ADMIN && (
              <div className="space-y-10">
                <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border p-5 rounded-xl">
                  <h3 className="text-md font-bold text-gray-900 dark:text-white mb-3">Default Model</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-muted mb-4">Users will start chats with this model unless they choose another one.</p>
                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <select value={defaultModelId} onChange={(e) => setDefaultModelId(e.target.value)} className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-4 py-2 text-gray-900 dark:text-white">
                      {allAvailableModels.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                    <button onClick={handleSaveDefaultModel} className="bg-forsion-600 hover:bg-forsion-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Save Default</button>
                  </div>
                </div>
                
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

            {/* --- USERS TAB (ADMIN) --- */}
            {activeTab === 'users' && userRole === UserRole.ADMIN && (
              <div className="space-y-8 max-w-3xl">
                <div className="bg-gray-50 dark:bg-zinc-900/40 p-6 rounded-xl border border-gray-200 dark:border-dark-border">
                  <div className="flex items-center gap-2 mb-4 text-forsion-600 dark:text-forsion-400">
                    <Shield size={20} />
                    <h3 className="text-lg font-bold">Manage Accounts</h3>
                  </div>
                  <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Username</label>
                      <input type="text" value={userForm.username} onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))} className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Password</label>
                      <input type="password" value={userForm.password} onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))} className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Role</label>
                      <select value={userForm.role} onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value as UserRole }))} className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white">
                        <option value={UserRole.USER}>User</option>
                        <option value={UserRole.ADMIN}>Admin</option>
                      </select>
                    </div>
                    <div className="md:col-span-3 flex justify-end">
                      <button type="submit" disabled={isUserActionLoading} className="bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60">
                        {isUserActionLoading ? 'Saving...' : 'Create User'}
                      </button>
                    </div>
                  </form>
                  {userMessage.text && (
                    <p className={`mt-3 text-sm ${userMessage.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{userMessage.text}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-md font-bold text-gray-900 dark:text-white mb-3">Existing Users</h3>
                  <div className="space-y-3">
                    {managedUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-dark-border rounded-lg">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{u.username}</div>
                          <div className="text-xs text-gray-500 dark:text-dark-muted">Role: {u.role}</div>
                        </div>
                        {u.username !== 'admin' ? (
                          <button onClick={() => handleDeleteUserAccount(u.username)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-md transition-colors">
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Locked</span>
                        )}
                      </div>
                    ))}
                    {managedUsers.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-dark-muted">No users found.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- INVITE CODES TAB (ADMIN) --- */}
            {activeTab === 'invite-codes' && userRole === UserRole.ADMIN && (
              <div className="space-y-8 max-w-3xl">
                <div className="bg-gray-50 dark:bg-zinc-900/40 p-6 rounded-xl border border-gray-200 dark:border-dark-border">
                  <div className="flex items-center gap-2 mb-4 text-forsion-600 dark:text-forsion-400">
                    <Ticket size={20} />
                    <h3 className="text-lg font-bold">Create Invite Code</h3>
                  </div>
                  <form onSubmit={handleCreateInviteCode} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Code</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={inviteCodeForm.code} 
                            onChange={(e) => setInviteCodeForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} 
                            className="flex-1 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" 
                            placeholder="INVITE123"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setInviteCodeForm(prev => ({ ...prev, code: generateRandomCode() }))}
                            className="px-3 py-2 bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-zinc-700"
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Max Uses</label>
                        <input 
                          type="number" 
                          value={inviteCodeForm.max_uses} 
                          onChange={(e) => setInviteCodeForm(prev => ({ ...prev, max_uses: parseInt(e.target.value) || 1 }))} 
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" 
                          min="1"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Initial Credits</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={inviteCodeForm.initial_credits} 
                          onChange={(e) => setInviteCodeForm(prev => ({ ...prev, initial_credits: parseFloat(e.target.value) || 0 }))} 
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" 
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Expires At (optional)</label>
                        <input 
                          type="datetime-local" 
                          value={inviteCodeForm.expires_at} 
                          onChange={(e) => setInviteCodeForm(prev => ({ ...prev, expires_at: e.target.value }))} 
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Notes (optional)</label>
                      <textarea 
                        value={inviteCodeForm.notes} 
                        onChange={(e) => setInviteCodeForm(prev => ({ ...prev, notes: e.target.value }))} 
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" 
                        rows={2}
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isInviteCodeLoading} 
                      className="bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {isInviteCodeLoading ? 'Creating...' : 'Create Invite Code'}
                    </button>
                  </form>
                </div>

                <div>
                  <h3 className="text-md font-bold text-gray-900 dark:text-white mb-3">Existing Invite Codes</h3>
                  <div className="space-y-3">
                    {inviteCodes.map((code) => (
                      <div key={code.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-dark-border rounded-lg">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 dark:text-white">{code.code}</div>
                          <div className="text-xs text-gray-500 dark:text-dark-muted">
                            Uses: {code.usedCount}/{code.maxUses} | Credits: {code.initialCredits} | 
                            {code.isActive ? ' Active' : ' Inactive'}
                            {code.expiresAt && ` | Expires: ${new Date(code.expiresAt).toLocaleDateString()}`}
                          </div>
                          {code.notes && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{code.notes}</div>
                          )}
                        </div>
                        <button 
                          onClick={() => handleDeleteInviteCode(code.id)} 
                          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-md transition-colors ml-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {inviteCodes.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-dark-muted">No invite codes found.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- CREDIT PRICING TAB (ADMIN) --- */}
            {activeTab === 'credit-pricing' && userRole === UserRole.ADMIN && (
              <div className="space-y-8 max-w-3xl">
                <div className="bg-gray-50 dark:bg-zinc-900/40 p-6 rounded-xl border border-gray-200 dark:border-dark-border">
                  <div className="flex items-center gap-2 mb-4 text-forsion-600 dark:text-forsion-400">
                    <Coins size={20} />
                    <h3 className="text-lg font-bold">Set Credit Pricing</h3>
                  </div>
                  <form onSubmit={handleSetPricing} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Model ID</label>
                        <input 
                          type="text" 
                          value={pricingForm.model_id} 
                          onChange={(e) => setPricingForm(prev => ({ ...prev, model_id: e.target.value }))} 
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" 
                          placeholder="gpt-4"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Provider (optional)</label>
                        <input 
                          type="text" 
                          value={pricingForm.provider} 
                          onChange={(e) => setPricingForm(prev => ({ ...prev, provider: e.target.value }))} 
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" 
                          placeholder="openai"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Tokens per Credit</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={pricingForm.tokens_per_credit} 
                          onChange={(e) => setPricingForm(prev => ({ ...prev, tokens_per_credit: parseFloat(e.target.value) || 100 }))} 
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" 
                          min="0.01"
                          required
                        />
                        <p className="text-xs text-gray-400 mt-1">1 credit = N tokens</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Input Multiplier</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={pricingForm.input_multiplier} 
                          onChange={(e) => setPricingForm(prev => ({ ...prev, input_multiplier: parseFloat(e.target.value) || 1 }))} 
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" 
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-dark-muted uppercase mb-1">Output Multiplier</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={pricingForm.output_multiplier} 
                          onChange={(e) => setPricingForm(prev => ({ ...prev, output_multiplier: parseFloat(e.target.value) || 1 }))} 
                          className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" 
                          min="0"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={isPricingLoading} 
                      className="bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {isPricingLoading ? 'Saving...' : 'Set Pricing'}
                    </button>
                  </form>
                </div>

                <div>
                  <h3 className="text-md font-bold text-gray-900 dark:text-white mb-3">Current Pricing Configurations</h3>
                  <div className="space-y-3">
                    {creditPricing.map((pricing) => (
                      <div key={pricing.id} className="p-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-dark-border rounded-lg">
                        <div className="font-semibold text-gray-900 dark:text-white">{pricing.modelId}</div>
                        <div className="text-xs text-gray-500 dark:text-dark-muted mt-1">
                          {pricing.tokensPerCredit} tokens/credit | 
                          Input: {pricing.inputMultiplier}x | 
                          Output: {pricing.outputMultiplier}x
                          {pricing.provider && ` | Provider: ${pricing.provider}`}
                        </div>
                      </div>
                    ))}
                    {creditPricing.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-dark-muted">No pricing configurations found. Default: 100 tokens per credit.</p>
                    )}
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