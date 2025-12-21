
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, ChatSession, Message, AIModel, AppSettings, UserRole, Attachment } from './types';
import { login } from './services/authService';
import { backendService } from './services/backendService'; // New backend
import { generateGeminiResponse, generateGeminiResponseStream } from './services/geminiService';
import { generateExternalResponse, generateExternalResponseStream } from './services/externalApiService';
import { BUILTIN_MODELS, DEFAULT_MODEL_ID, getAllModels, getConfiguredModels, STORAGE_KEYS } from './constants';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import RegisterModal from './components/RegisterModal';
import { Send, Zap, Menu, Sparkles, MessageSquare, Code, Brain, BrainCircuit, Image as ImageIcon, ChevronDown, Paperclip, X as XIcon, Box, Square } from 'lucide-react';
import { getPresetAvatar, svgToDataUrl } from './src/utils/presetAvatars';
import { detectImageGenerationIntent, generateImage, detectImageEditIntent, editImage, imageToImage } from './services/imageGenerationService';
import CommandAutocomplete from './components/CommandAutocomplete';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  // Register form state
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // App State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  
  // Streaming response state
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  // AbortController for canceling requests
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const hasManualModelSelection = useRef(false);
  const previousDefaultModelId = useRef<string | null>(null);

  // Theme & Settings
  const [theme, setTheme] = useState<'light' | 'dark'>('dark'); // Default to Dark
  const [themePreset, setThemePreset] = useState<'default' | 'notion' | 'monet'>('default');
  const [customModels, setCustomModels] = useState<AIModel[]>([]);
  const [globalModels, setGlobalModels] = useState<AIModel[]>([]); // Models from backend admin
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(!backendService.isBackendOnline());
  
  // Deep Thinking Toggle
  const [isDeepThinking, setIsDeepThinking] = useState<boolean>(false);
  
  // Force Image Generation Toggle
  const [forceImageGeneration, setForceImageGeneration] = useState<boolean>(false);
  
  // Command Autocomplete State
  const [showCommandAutocomplete, setShowCommandAutocomplete] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Media Upload State
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Expanded Input Modal State
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [expandedInput, setExpandedInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mobile UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const clearAuthState = useCallback((reason?: string) => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_username');
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setUser(null);
    setAuthError(reason || '');
    setCurrentSessionId(null);
    setIsSidebarOpen(false);
    hasManualModelSelection.current = false;
    previousDefaultModelId.current = null;
    setSelectedModelId(DEFAULT_MODEL_ID);
  }, []);

  const syncSettingsFromBackend = useCallback(async () => {
    try {
      // Fetch settings and global models in parallel
      const [settings, backendModels] = await Promise.all([
        backendService.getSettings(),
        backendService.getGlobalModels()
      ]);
      
      setAppSettings(settings);
      // Load theme and themePreset from database
      // Always respect saved theme (including 'light' if that's what user saved)
      if (settings.theme !== undefined && settings.theme !== null) {
        console.log('Loading theme from database:', settings.theme);
        setTheme(settings.theme);
      }
      if (settings.themePreset !== undefined && settings.themePreset !== null) {
        console.log('Loading themePreset from database:', settings.themePreset);
        setThemePreset(settings.themePreset);
      }
      setCustomModels(settings.customModels || []);
      
      // Update user profile if settings contain nickname or avatar
      // Always update if nickname or avatar is in settings (even if null/empty)
      if (user && (settings.nickname !== undefined || settings.avatar !== undefined)) {
        const updatedUser = {
          ...user,
          nickname: settings.nickname !== undefined ? settings.nickname : user.nickname,
          avatar: settings.avatar !== undefined ? settings.avatar : user.avatar
        };
        setUser(updatedUser);
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      }
      
      // Convert backend models to AIModel format
      const convertedGlobalModels: AIModel[] = (backendModels || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        provider: m.provider || 'external',
        description: m.description || '',
        icon: m.icon || 'Box',
        avatar: m.avatar,
        apiModelId: m.apiModelId,
        configKey: m.configKey || m.id,
        defaultBaseUrl: m.defaultBaseUrl,
        isCustom: false,
        isGlobal: true, // Mark as global model from backend
      }));
      setGlobalModels(convertedGlobalModels);
      
      // Combine all model sources: global models + configured built-ins + user custom models
      const configuredBuiltins = getConfiguredModels([], settings.externalApiConfigs || {});
      const allAvailable = [...convertedGlobalModels, ...configuredBuiltins, ...(settings.customModels || [])];
      
      const desiredModel = settings.defaultModelId || DEFAULT_MODEL_ID;
      const preferredModel = allAvailable.length > 0 && allAvailable.some(m => m.id === desiredModel) 
        ? desiredModel 
        : (allAvailable.length > 0 ? allAvailable[0].id : DEFAULT_MODEL_ID);
      
      // Check if default model has changed
      const defaultModelChanged = previousDefaultModelId.current !== null && 
                                  previousDefaultModelId.current !== preferredModel;
      
      // Update selected model if:
      // 1. User hasn't manually selected a model, OR
      // 2. Default model changed AND current selection was the old default (follow default changes)
      if (!hasManualModelSelection.current) {
        setSelectedModelId(preferredModel);
      } else if (defaultModelChanged && selectedModelId === previousDefaultModelId.current) {
        // Default model changed and user was using the old default, update to new default
        setSelectedModelId(preferredModel);
        hasManualModelSelection.current = false; // Reset flag so future default changes apply
      }
      
      // Update previous default model reference
      previousDefaultModelId.current = preferredModel;
    } catch (e: any) {
      // Token expired/invalid: backend reachable but auth is not.
      if (e?.code === 'AUTH_REQUIRED' || e?.name === 'AuthRequiredError') {
        clearAuthState('Session expired. Please sign in again.');
        return;
      }
      console.error("Failed to load settings from backend", e);
    }
  }, [clearAuthState]);

  // Initial Load (Backend Simulation)
  useEffect(() => {
    const unsubscribe = backendService.subscribeToConnection((online) => setIsOfflineMode(!online));
    
    // Ping backend on startup to check connection
    backendService.pingBackend().catch(() => {
      console.warn('Initial backend ping failed, will retry on first API call');
    });
    
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    const initApp = async () => {
      // 1. Load User
      const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (storedUser) setUser(JSON.parse(storedUser));
      
      // 2. Load Sessions
      const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (storedSessions) setSessions(JSON.parse(storedSessions));

      // 3. Load Settings from Backend
      await syncSettingsFromBackend();
    };

    initApp();
  }, [syncSettingsFromBackend]);

  const attemptReconnect = useCallback(async () => {
    const success = await backendService.pingBackend();
    if (success) {
      await syncSettingsFromBackend();
    }
    return success;
  }, [syncSettingsFromBackend]);

  // Theme Application Effect
  useEffect(() => {
    // This is the standard way to toggle Tailwind Dark Mode
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Update body class for seamless backgrounds (dragging areas etc)
    const bodyClass = themePreset === 'monet'
      ? 'bg-desktop-surface'
      : theme === 'dark' 
        ? (themePreset === 'notion' ? 'bg-notion-darkbg' : 'bg-dark-bg')
        : (themePreset === 'notion' ? 'bg-notion-bg' : 'bg-white');
      
    document.body.className = `${bodyClass} transition-colors duration-300`;

  }, [theme, themePreset]);

  // Persist Sessions locally (could move to backend too in future)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  }, [sessions]);

  // Handle Settings Updates
  const updateAppSettings = async (newSettings: Partial<AppSettings>) => {
    // Ensure we have appSettings initialized, if not, create a minimal one
    const baseSettings = appSettings || {
      externalApiConfigs: {},
      customModels: [],
    };
    
    // Always include current theme and themePreset in the settings to save
    // This ensures both values are always persisted together
    const settingsToSave: Partial<AppSettings> = {
      ...baseSettings,
      theme: theme, // Always include current theme state
      themePreset: themePreset, // Always include current themePreset state
      ...newSettings, // Override with new values if provided
    };
    
    // Update local state optimistically
    setAppSettings(settingsToSave as AppSettings);
    
    // Update UI state immediately
    if (newSettings.theme !== undefined) setTheme(newSettings.theme);
    if (newSettings.themePreset !== undefined) setThemePreset(newSettings.themePreset);
    if (newSettings.customModels !== undefined) setCustomModels(newSettings.customModels);
    
    // Update user profile immediately if nickname or avatar changed
    if (user && (newSettings.nickname !== undefined || newSettings.avatar !== undefined)) {
      const updatedUser = {
        ...user,
        nickname: newSettings.nickname !== undefined ? newSettings.nickname : user.nickname,
        avatar: newSettings.avatar !== undefined ? newSettings.avatar : user.avatar
      };
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    }

    // Sync with backend (save to database)
    try {
      console.log('Saving settings to database:', { 
        theme: settingsToSave.theme, 
        themePreset: settingsToSave.themePreset,
        nickname: settingsToSave.nickname,
        avatar: settingsToSave.avatar ? `${settingsToSave.avatar.substring(0, 50)}...` : null
      });
      const savedSettings = await backendService.updateSettings(settingsToSave);
      console.log('Settings saved successfully:', savedSettings);
      // Update appSettings with the response from server to ensure consistency
      if (savedSettings) {
        setAppSettings(savedSettings);
        // Also update theme and themePreset state from server response
        if (savedSettings.theme !== undefined) setTheme(savedSettings.theme);
        if (savedSettings.themePreset !== undefined) setThemePreset(savedSettings.themePreset);
        
        // Update user profile from server response
        if (user && (savedSettings.nickname !== undefined || savedSettings.avatar !== undefined)) {
          const updatedUser = {
            ...user,
            nickname: savedSettings.nickname !== undefined ? savedSettings.nickname : user.nickname,
            avatar: savedSettings.avatar !== undefined ? savedSettings.avatar : user.avatar
          };
          setUser(updatedUser);
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
        }
      }
    } catch (e: any) {
      if (e?.code === 'AUTH_REQUIRED' || e?.name === 'AuthRequiredError') {
        clearAuthState('Session expired. Please sign in again.');
        return;
      }
      // For theme changes, show error but don't revert (user already sees the change)
      if (newSettings.theme !== undefined || newSettings.themePreset !== undefined) {
        console.error('Failed to save theme settings to database:', e);
        alert('Failed to save theme settings. Please try again.');
      } else {
        throw e;
      }
    }
  };

  // Combined Model List - global models from backend + configured built-ins + user custom models
  const configuredBuiltins = getConfiguredModels([], appSettings?.externalApiConfigs || {});
  const allModels = [...globalModels, ...configuredBuiltins, ...customModels];

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError('');
    try {
      const u = await login(username, password);
      if (u) {
        setUser(u);
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(u));
        setUsername('');
        setPassword('');
      } else {
        setAuthError('Invalid credentials');
      }
    } catch (err) {
      setAuthError('Login failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthState();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    // Validation
    if (!registerUsername || !registerPassword || !inviteCode) {
      setAuthError('All fields are required');
      return;
    }

    if (registerPassword.length < 4) {
      setAuthError('Password must be at least 4 characters');
      return;
    }

    if (registerPassword !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }

    setIsAuthLoading(true);
    try {
      const registeredUser = await backendService.register(registerUsername, registerPassword, inviteCode);
      setUser(registeredUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(registeredUser));
      // Reset form
      setRegisterUsername('');
      setRegisterPassword('');
      setConfirmPassword('');
      setInviteCode('');
      setAuthMode('login');
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRegisterSuccess = (registeredUser: User) => {
    setUser(registeredUser);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(registeredUser));
    setShowRegisterModal(false);
  };

  // Chat Handlers
  const createNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      modelId: selectedModelId,
      messages: [],
      updatedAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    return newSession.id;
  }, [selectedModelId]);

  // File Handler with support for documents
  const processFile = async (file: File) => {
    const reader = new FileReader();
    
    // Determine file type
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isWord = file.type === 'application/msword' || 
                   file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isText = file.type === 'text/plain' || file.type === 'text/markdown';
    
    if (isImage) {
      // Handle image files
      reader.onload = (event) => {
        if (event.target?.result) {
          setAttachment({
            type: 'image',
            url: event.target.result as string,
            mimeType: file.type,
            name: file.name
          });
        }
      };
      reader.readAsDataURL(file);
    } else if (isText) {
      // Handle text files - read as text
      reader.onload = (event) => {
        if (event.target?.result) {
          const textContent = event.target.result as string;
          setAttachment({
            type: 'document',
            url: '', // No preview URL for text
            mimeType: file.type,
            name: file.name,
            extractedText: textContent
          });
        }
      };
      reader.readAsText(file);
    } else if (isPdf || isWord) {
      // Handle PDF and Word files - try backend extraction first
      try {
        const result = await backendService.parseFile(file);
        if (result.text) {
          setAttachment({
            type: 'document',
            url: result.base64 ? `data:${file.type};base64,${result.base64}` : '',
            mimeType: file.type,
            name: file.name,
            extractedText: result.text
          });
          return;
        }
      } catch (error) {
        console.warn('Backend file parsing failed, using fallback', error);
      }
      
      // Fallback: read as base64 with hint text
      reader.onload = async (event) => {
        if (event.target?.result) {
          const base64 = event.target.result as string;
          let extractedText = '';
          
          // Try backend parsing with base64
          try {
            const result = await backendService.parseBase64(base64, file.name, file.type);
            if (result.text) {
              extractedText = result.text;
            }
          } catch {
            // Use placeholder if backend fails
            if (isPdf) {
              extractedText = `[PDF Document: ${file.name}]\n\nNote: The document has been attached. Text extraction requires backend support.`;
            } else if (isWord) {
              extractedText = `[Word Document: ${file.name}]\n\nNote: The document has been attached. Text extraction requires backend support.`;
            }
          }
          
          setAttachment({
            type: 'document',
            url: base64,
            mimeType: file.type,
            name: file.name,
            extractedText: extractedText
          });
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert('Unsupported file type. Please upload images, PDFs, Word documents, or text files.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAttachment = () => setAttachment(null);

  // Stop generation handler
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setStreamingMessageId(null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !attachment) || isProcessing) return;
    
    // Check if any model is configured
    if (allModels.length === 0) {
      alert('No models configured. Please enable Developer Mode in Settings to add a model, or contact admin.');
      return;
    }

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createNewSession();
    }

    const currentModel = allModels.find(m => m.id === selectedModelId) || allModels[0];
    const currentAttachments = attachment ? [attachment] : [];
    
    // 处理 /dt 命令（深度思考）
    let finalInput = input;
    let shouldUseDeepThinking = isDeepThinking;
    
    if (input.trim().startsWith('/dt ')) {
      finalInput = input.trim().substring(4); // Remove '/dt ' prefix
      shouldUseDeepThinking = true;
    } else if (input.trim() === '/dt') {
      finalInput = '';
      shouldUseDeepThinking = true;
    }
    
    // If there's a document attachment with extracted text, include it in the message
    let messageContent = finalInput;
    if (attachment?.type === 'document' && attachment.extractedText) {
      messageContent = `${finalInput}\n\n---\n📄 Attached Document: ${attachment.name}\n\n${attachment.extractedText}`;
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      attachments: currentAttachments,
      timestamp: Date.now(),
    };

    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          messages: [...s.messages, userMessage],
          title: s.messages.length === 0 ? finalInput.substring(0, 30) || 'Chat' : s.title,
          updatedAt: Date.now()
        };
      }
      return s;
    }));

    setInput('');
    setAttachment(null);
    setIsProcessing(true);
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    // 检测是否为图像编辑或以图生图请求
    const hasImageAttachment = currentAttachments.length > 0 && currentAttachments[0].type === 'image';
    const { isEditRequest, isImg2ImgRequest, prompt: editPrompt, mode: editMode } = hasImageAttachment 
      ? detectImageEditIntent(finalInput, true)
      : { isEditRequest: false, isImg2ImgRequest: false, prompt: finalInput, mode: 'none' as const };
    
    if ((isEditRequest || isImg2ImgRequest) && hasImageAttachment) {
      // 处理图像编辑或以图生图请求
      const botMessageId = (Date.now() + 1).toString();
      const modeText = isEditRequest ? '编辑图像' : '以图生图';
      const botMessage: Message = {
        id: botMessageId,
        role: 'model',
        content: `正在${modeText}...`,
        timestamp: Date.now(),
        modelId: currentModel.id,
        editMode: editMode,
        sourceImageUrl: currentAttachments[0].url
      };

      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return { ...s, messages: [...s.messages, botMessage], updatedAt: Date.now() };
        }
        return s;
      }));

      try {
        let result: { imageUrl: string; usage?: { prompt_tokens: number; completion_tokens: number } };
        const imageBase64 = currentAttachments[0].url;
        
        // 使用全局模型（后端代理）
        if ((currentModel as any).isGlobal) {
          console.log('[handleSendMessage] Using backend proxy for image editing/img2img with global model');
          result = await backendService.proxyImageEdit(
            currentModel.id,
            editPrompt,
            imageBase64,
            editMode,
            '1024x1024',
            'standard',
            isImg2ImgRequest ? 0.7 : 0.5 // Higher strength for img2img
          );
        } else {
          // 使用前端配置的API
          let configKey = currentModel.configKey || 'openai';
          let config = appSettings?.externalApiConfigs?.[configKey];
          
          if (!config || !config.apiKey) {
            // 尝试使用Stability AI（如果配置了）
            const stabilityConfig = appSettings?.externalApiConfigs?.['stability'];
            if (stabilityConfig && stabilityConfig.apiKey) {
              config = stabilityConfig;
              configKey = 'stability';
            }
          }
          
          if (!config || !config.apiKey) {
            throw new Error(`图像${modeText}API密钥未配置。请在设置中配置API密钥以使用此功能。`);
          }

          const imageGenConfig = {
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            provider: (configKey === 'stability' ? 'stability' : 'openai') as 'openai' | 'stability'
          };

          if (isEditRequest) {
            result = await editImage(imageGenConfig, editPrompt, imageBase64, {
              size: '1024x1024',
              quality: 'standard',
              provider: imageGenConfig.provider
            });
          } else {
            result = await imageToImage(imageGenConfig, editPrompt, imageBase64, {
              size: '1024x1024',
              strength: 0.7,
              provider: imageGenConfig.provider
            });
          }
        }

        // 更新消息显示结果图像
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === botMessageId
                  ? { ...m, content: `已${modeText}：${editPrompt}`, imageUrl: result.imageUrl }
                  : m
              ),
              updatedAt: Date.now()
            };
          }
          return s;
        }));

        // 记录API使用
        if (result.usage && user) {
          try {
            await backendService.logApiUsage(
              currentModel.id,
              currentModel.name,
              currentModel.provider || 'external',
              result.usage.prompt_tokens || 0,
              result.usage.completion_tokens || 0,
              true
            );
          } catch (logError) {
            console.error('Failed to log API usage:', logError);
          }
        }
      } catch (error: any) {
        console.error(`Image ${modeText} error:`, error);
        
        // 更新消息显示错误
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === botMessageId
                  ? { 
                      ...m, 
                      content: error.message || `图像${modeText}失败`,
                      isError: true,
                      imageUrl: undefined
                    }
                  : m
              ),
              updatedAt: Date.now()
            };
          }
          return s;
        }));
      } finally {
        setIsProcessing(false);
        setStreamingMessageId(null);
      }
      return;
    }
    
    // 检测是否为图像生成请求（包括强制画图开关）
    const { isImageRequest, prompt: imagePrompt } = detectImageGenerationIntent(finalInput);
    const shouldGenerateImage = isImageRequest || forceImageGeneration;
    
    if (shouldGenerateImage) {
      const promptToUse = forceImageGeneration && !isImageRequest ? finalInput : imagePrompt;
      // 处理图像生成请求
      const botMessageId = (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botMessageId,
        role: 'model',
        content: '正在生成图像...',
        timestamp: Date.now(),
        modelId: currentModel.id
      };

      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return { ...s, messages: [...s.messages, botMessage], updatedAt: Date.now() };
        }
        return s;
      }));

      try {
        let result: { imageUrl: string; usage?: { prompt_tokens: number; completion_tokens: number } };
        
        // 优先检查当前模型是否支持图像生成（如Gemini的图像模型）
        if (currentModel.provider === 'gemini' && currentModel.id === 'gemini-2.5-flash-image') {
          // 使用Gemini的图像生成能力
          const configKey = currentModel.configKey || 'google';
          const config = appSettings?.externalApiConfigs?.[configKey];
          
          if (!config || !config.apiKey) {
            throw new Error('Gemini API密钥未配置。请在设置中配置Google API密钥以使用图像生成功能。');
          }

          const geminiResult = await generateGeminiResponseStream(
            currentModel.id,
            promptToUse || finalInput,
            [],
            config.apiKey,
            [],
            (content) => {
              // Update streaming message if needed
              setSessions(prev => prev.map(s => {
                if (s.id === sessionId) {
                  return {
                    ...s,
                    messages: s.messages.map(m =>
                      m.id === botMessageId
                        ? { ...m, content: content || '正在生成图像...' }
                        : m
                    ),
                    updatedAt: Date.now()
                  };
                }
                return s;
              }));
            },
            false,
            abortControllerRef.current?.signal
          );

          if (!geminiResult.imageUrl) {
            throw new Error('Gemini模型未能生成图像。');
          }

          result = {
            imageUrl: geminiResult.imageUrl,
            usage: geminiResult.usage
          };
        } else {
          // 使用外部图像生成API（OpenAI DALL-E等）
          // 优先检查是否是全局模型（使用后端存储的API密钥）
          if ((currentModel as any).isGlobal) {
            // 对于全局模型，使用后端代理（后端存储的API密钥）
            console.log('[handleSendMessage] Using backend proxy for image generation with global model');
            result = await backendService.proxyImageGeneration(
              currentModel.id,
              promptToUse || finalInput,
              '1024x1024',
              'standard'
            );
          } else {
            // 非全局模型，使用前端配置
            let configKey = 'openai';
            let config = appSettings?.externalApiConfigs?.[configKey];
            
            // 如果OpenAI未配置，尝试使用其他已配置的提供商
            if (!config || !config.apiKey) {
              // 尝试查找其他已配置的API
              const availableConfigs = Object.entries(appSettings?.externalApiConfigs || {});
              const configuredProvider = availableConfigs.find(([key, cfg]) => cfg.apiKey && cfg.apiKey.trim() !== '');
              
              if (configuredProvider) {
                configKey = configuredProvider[0];
                config = configuredProvider[1];
              }
            }
            
            if (!config || !config.apiKey) {
              throw new Error('图像生成API密钥未配置。请在设置中配置OpenAI API密钥以使用图像生成功能。');
            }

            result = await generateImage(
              {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                provider: 'openai',
              },
              promptToUse || finalInput,
              {
                size: '1024x1024',
                quality: 'standard',
              }
            );
          }
        }

        // 更新消息显示生成的图像
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === botMessageId
                  ? { ...m, content: `已生成图像：${promptToUse || finalInput}`, imageUrl: result.imageUrl }
                  : m
              ),
              updatedAt: Date.now()
            };
          }
          return s;
        }));

        // 记录API使用（如果用户已登录）
        if (result.usage && user) {
          try {
            const modelName = currentModel.provider === 'gemini' && currentModel.id === 'gemini-2.5-flash-image'
              ? 'Gemini Image Generation'
              : 'DALL-E 3';
            const provider = currentModel.provider === 'gemini' && currentModel.id === 'gemini-2.5-flash-image'
              ? 'google'
              : 'openai';
            const modelId = currentModel.provider === 'gemini' && currentModel.id === 'gemini-2.5-flash-image'
              ? 'gemini-2.5-flash-image'
              : 'dall-e-3';
            
            await backendService.logApiUsage(
              modelId,
              modelName,
              provider,
              result.usage.prompt_tokens || 0,
              result.usage.completion_tokens || 0,
              true
            );
          } catch (logError) {
            console.warn('Failed to log API usage:', logError);
          }
        }
      } catch (error: any) {
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === botMessageId
                  ? { ...m, content: `错误: ${error.message}`, isError: true }
                  : m
              )
            };
          }
          return s;
        }));
      } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
      
      return; // 图像生成请求处理完毕，不继续执行聊天逻辑
    }

    // Create placeholder bot message for streaming
    const botMessageId = (Date.now() + 1).toString();
    const botMessage: Message = {
      id: botMessageId,
      role: 'model',
      content: '',
      timestamp: Date.now(),
      modelId: currentModel.id // Save the model ID used for this message
    };

    // Add empty bot message to start streaming into
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, messages: [...s.messages, botMessage], updatedAt: Date.now() };
      }
      return s;
    }));
    setStreamingMessageId(botMessageId);

    try {
      let responseImage: string | undefined;
      const session = sessions.find(s => s.id === sessionId);

      // Use settings from state (which is synced with backend)
      const configKey = currentModel.configKey || currentModel.id;
      const config = appSettings?.externalApiConfigs?.[configKey];

      // Update message callback for streaming
      const updateStreamingMessage = (content: string, reasoning?: string) => {
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m => 
                m.id === botMessageId 
                  ? { ...m, content, reasoning }
                  : m
              ),
              updatedAt: Date.now()
            };
          }
          return s;
        }));
      };

      let usage: { prompt_tokens: number; completion_tokens: number } | undefined;

      if (currentModel.provider === 'gemini') {
         // Gemini Logic with streaming
         console.log('[handleSendMessage] Using Gemini provider for model:', currentModel.id);
         const history = currentModel.id === 'gemini-2.5-flash-image' ? [] : 
            (session?.messages || []).filter(m => m.id !== botMessageId).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
         
         const result = await generateGeminiResponseStream(
           currentModel.id, 
           userMessage.content, 
           history, 
           config?.apiKey, 
           currentAttachments,
           updateStreamingMessage,
           shouldUseDeepThinking,
           abortControllerRef.current?.signal
         );
         console.log('[handleSendMessage] Gemini response received');
         responseImage = result.imageUrl;
         usage = result.usage;

         // Final update with image if present
         if (responseImage) {
           setSessions(prev => prev.map(s => {
             if (s.id === sessionId) {
               return {
                 ...s,
                 messages: s.messages.map(m => 
                   m.id === botMessageId 
                     ? { ...m, imageUrl: responseImage }
                     : m
                 )
               };
             }
             return s;
           }));
         }

      } else {
        // External Logic
        const history = (session?.messages || []).filter(m => m.id !== botMessageId).map(m => ({
            role: m.role === 'model' ? 'assistant' : m.role === 'user' ? 'user' : 'system',
            content: m.content
        }));
        history.push({ role: 'user', content: userMessage.content });

        // Check if this is a global model (uses backend proxy) - now with streaming support
        // Note: gemini-2.5-flash-image should always use direct Gemini API, not backend proxy
        console.log('[handleSendMessage] Model:', currentModel.id, 'isGlobal:', (currentModel as any).isGlobal);
        if ((currentModel as any).isGlobal && currentModel.id !== 'gemini-2.5-flash-image') {
           console.log('[handleSendMessage] Using proxyChatCompletions for global model');
           const result = await backendService.proxyChatCompletions(
             currentModel.id,
             history,
             0.7,
             shouldUseDeepThinking,
             undefined,
             updateStreamingMessage,
             abortControllerRef.current?.signal,
             currentAttachments // Pass attachments to backend
           );
           usage = result.usage;
        } else if (!config || !config.apiKey) {
           throw new Error(`API Key for ${currentModel.name} is missing. Please configure it in Settings.`);
        } else {
           console.log('[handleSendMessage] Using generateExternalResponseStream for external model');
           const apiModelId = currentModel.apiModelId || currentModel.id;
           const result = await generateExternalResponseStream(
             config, 
             apiModelId, 
             history, 
             currentModel.defaultBaseUrl, 
             currentAttachments,
             updateStreamingMessage,
             shouldUseDeepThinking,
             abortControllerRef.current?.signal
           );
           usage = result.usage;
        }
      }

      // Log API usage after successful completion
      if (usage && user) {
        try {
          await backendService.logApiUsage(
            currentModel.id,
            currentModel.name,
            currentModel.provider || 'unknown',
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            true
          );
        } catch (logError) {
          // Silent fail for usage logging - don't interrupt user experience
          console.warn('Failed to log API usage:', logError);
        }
      }

    } catch (error: any) {
      // Don't show error if request was aborted
      if (error?.name === 'AbortError') {
        // Request was cancelled, update message to indicate it was stopped
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m => 
                m.id === botMessageId 
                  ? { ...m, content: m.content || '(Generation stopped)' }
                  : m
              )
            };
          }
          return s;
        }));
        return;
      }
      
      if (error?.code === 'AUTH_REQUIRED' || error?.name === 'AuthRequiredError') {
        clearAuthState('Session expired. Please sign in again.');
        return;
      }
      // Update the streaming message to show error
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: s.messages.map(m => 
              m.id === botMessageId 
                ? { ...m, content: `Error: ${error.message}`, isError: true }
                : m
            )
          };
        }
        return s;
      }));
    } finally {
      setIsProcessing(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  };

  // Regenerate a specific model response
  const handleRegenerateMessage = async (messageId: string) => {
    if (!currentSessionId || isProcessing) return;
    
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;
    
    // Find the message to regenerate and the previous user message
    const messageIndex = session.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    // Find the last user message before this model message
    let userMessageIndex = messageIndex - 1;
    while (userMessageIndex >= 0 && session.messages[userMessageIndex].role !== 'user') {
      userMessageIndex--;
    }
    
    if (userMessageIndex < 0) return;
    
    const userMessage = session.messages[userMessageIndex];
    const userAttachments = userMessage.attachments || [];
    
    // Extract the original input (without document attachment text)
    const originalInput = userMessage.content.split('\n\n---\n📄')[0];
    
    // Remove all messages from the model response onwards
    const messagesBeforeRegenerate = session.messages.slice(0, messageIndex);
    
    // Update sessions to remove the old response
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          messages: messagesBeforeRegenerate,
          updatedAt: Date.now()
        };
      }
      return s;
    }));
    
    // Directly trigger regeneration with the captured content
    await regenerateWithContent(currentSessionId, originalInput, userAttachments, messagesBeforeRegenerate);
  };
  
  // Helper function to regenerate with specific content
  const regenerateWithContent = async (
    sessionId: string, 
    content: string, 
    attachments: Attachment[], 
    historyMessages: Message[]
  ) => {
    if (isProcessing) return;
    
    const currentModel = allModels.find(m => m.id === selectedModelId) || allModels[0];
    if (!currentModel) return;
    
    setIsProcessing(true);
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    // Create placeholder bot message for streaming
    const botMessageId = (Date.now() + 1).toString();
    const botMessage: Message = {
      id: botMessageId,
      role: 'model',
      content: '',
      timestamp: Date.now(),
      modelId: currentModel.id // Save the model ID used for this message
    };
    
    // Add empty bot message to start streaming into
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, messages: [...historyMessages, botMessage], updatedAt: Date.now() };
      }
      return s;
    }));
    setStreamingMessageId(botMessageId);
    
    try {
      let responseImage: string | undefined;
      
      const configKey = currentModel.configKey || currentModel.id;
      const config = appSettings?.externalApiConfigs?.[configKey];
      
      // Update message callback for streaming
      const updateStreamingMessage = (streamContent: string, reasoning?: string) => {
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m => 
                m.id === botMessageId 
                  ? { ...m, content: streamContent, reasoning }
                  : m
              ),
              updatedAt: Date.now()
            };
          }
          return s;
        }));
      };
      
      // Build history from the messages before regeneration (excluding the user message we're regenerating from)
      const historyForApi = historyMessages.slice(0, -1).map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role === 'user' ? 'user' : 'system',
        content: m.content
      }));
      historyForApi.push({ role: 'user', content });
      
      let usage: { prompt_tokens: number; completion_tokens: number } | undefined;

      if (currentModel.provider === 'gemini') {
        const geminiHistory = currentModel.id === 'gemini-2.5-flash-image' ? [] : 
          historyMessages.slice(0, -1).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
        
        const result = await generateGeminiResponseStream(
          currentModel.id, 
          content, 
          geminiHistory, 
          config?.apiKey, 
          attachments,
          updateStreamingMessage,
          isDeepThinking,
          abortControllerRef.current?.signal
        );
        responseImage = result.imageUrl;
        usage = result.usage;
        
        if (responseImage) {
          setSessions(prev => prev.map(s => {
            if (s.id === sessionId) {
              return {
                ...s,
                messages: s.messages.map(m => 
                  m.id === botMessageId 
                    ? { ...m, imageUrl: responseImage }
                    : m
                )
              };
            }
            return s;
          }));
        }
      } else {
        if ((currentModel as any).isGlobal) {
          const result = await backendService.proxyChatCompletions(
            currentModel.id,
            historyForApi,
            0.7,
            isDeepThinking,
            undefined,
            updateStreamingMessage,
            abortControllerRef.current?.signal
          );
          usage = result.usage;
        } else if (!config || !config.apiKey) {
          throw new Error(`API Key for ${currentModel.name} is missing. Please configure it in Settings.`);
        } else {
          const apiModelId = currentModel.apiModelId || currentModel.id;
          const result = await generateExternalResponseStream(
            config, 
            apiModelId, 
            historyForApi, 
            currentModel.defaultBaseUrl, 
            attachments,
            updateStreamingMessage,
            isDeepThinking,
            abortControllerRef.current?.signal
          );
          usage = result.usage;
        }
      }

      // Log API usage after successful completion
      if (usage && user) {
        try {
          await backendService.logApiUsage(
            currentModel.id,
            currentModel.name,
            currentModel.provider || 'unknown',
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            true
          );
        } catch (logError) {
          // Silent fail for usage logging - don't interrupt user experience
          console.warn('Failed to log API usage:', logError);
        }
      }
    } catch (error: any) {
      // Don't show error if request was aborted
      if (error?.name === 'AbortError') {
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m => 
                m.id === botMessageId 
                  ? { ...m, content: m.content || '(Generation stopped)' }
                  : m
              )
            };
          }
          return s;
        }));
        return;
      }
      
      if (error?.code === 'AUTH_REQUIRED' || error?.name === 'AuthRequiredError') {
        clearAuthState('Session expired. Please sign in again.');
        return;
      }
      
      // Log failed API usage
      if (currentModel) {
        try {
          // Try to get username from user object or localStorage
          const username = user?.username || localStorage.getItem('current_username') || 'anonymous';
          if (username && username !== 'anonymous') {
            await backendService.logApiUsage(
              currentModel.id,
              currentModel.name,
              currentModel.provider || 'unknown',
              0,
              0,
              false,
              error.message || 'Unknown error'
            );
          }
        } catch (logError) {
          // Silent fail for usage logging
          console.warn('Failed to log API usage error:', logError);
        }
      }
      
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: s.messages.map(m => 
              m.id === botMessageId 
                ? { ...m, content: `Error: ${error.message}`, isError: true }
                : m
            )
          };
        }
        return s;
      }));
    } finally {
      setIsProcessing(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const renameSession = (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s
    ));
  };

  const archiveSession = (id: string) => {
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, archived: !s.archived, updatedAt: Date.now() } : s
    ));
  };

  const updateSessionEmoji = (id: string, emoji: string) => {
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, emoji: emoji || undefined, updatedAt: Date.now() } : s
    ));
  };

  const getModelIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap': return <Zap size={16} />;
      case 'Brain': return <Brain size={16} />;
      case 'Image': return <ImageIcon size={16} />;
      case 'MessageSquare': return <MessageSquare size={16} />;
      case 'Code': return <Code size={16} />;
      case 'Sparkles': return <Sparkles size={16} />;
      case 'BrainCircuit': return <BrainCircuit size={16} />;
      case 'Box': return <Box size={16} />;
      default: return <Zap size={16} />;
    }
  };

  // Model Avatar Icon component for dropdown
  const ModelAvatarIcon: React.FC<{ model: AIModel }> = ({ model }) => {
    const avatarUrl = useMemo(() => {
      if (!model.avatar) return null;
      
      if (model.avatar.startsWith('preset:')) {
        const presetId = model.avatar.substring(7);
        const preset = getPresetAvatar(presetId);
        if (preset) return svgToDataUrl(preset.svg);
      } else if (model.avatar.startsWith('data:image/')) {
        return model.avatar;
      }
      return null;
    }, [model.avatar]);
    
    if (avatarUrl) {
      return (
        <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
          <img src={avatarUrl} alt={model.name} className="w-full h-full object-cover" />
        </div>
      );
    }
    
    return <div className="text-gray-500 dark:text-dark-muted">{getModelIcon(model.icon)}</div>;
  };

  // Auth Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-dark-bg to-dark-bg"></div>
        
        <div className="bg-dark-card w-full max-w-md p-8 rounded-2xl shadow-2xl border border-dark-border relative z-10 backdrop-blur-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-forsion-500 via-purple-500 to-pink-500"></div>
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-forsion-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-forsion-500/20">
              <span className="text-3xl font-bold text-white">F</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Forsion AI Studio</h1>
            <p className="text-dark-muted text-sm">Enterprise Grade AI Platform</p>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-muted uppercase mb-1.5 ml-1">Username</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-forsion-500 focus:ring-1 focus:ring-forsion-500 transition-all" 
                  placeholder="Enter username"
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-dark-muted uppercase mb-1.5 ml-1">Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-forsion-500 focus:ring-1 focus:ring-forsion-500 transition-all" 
                  placeholder="Enter password"
                  required 
                />
              </div>
              
              {authError && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
                  <p className="text-red-400 text-sm text-center font-medium">{authError}</p>
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isAuthLoading}
                className="w-full bg-white text-black hover:bg-gray-100 font-bold py-3.5 rounded-lg transition-all transform active:scale-[0.98] shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {isAuthLoading ? 'Processing...' : 'Sign In'}
              </button>
              
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError('');
                  }}
                  className="text-dark-muted hover:text-white text-sm transition-colors"
                >
                  Don't have an account? <span className="text-forsion-400 font-medium">Register</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-muted uppercase mb-1.5 ml-1">Username</label>
                <input 
                  type="text" 
                  value={registerUsername} 
                  onChange={(e) => setRegisterUsername(e.target.value)} 
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-forsion-500 focus:ring-1 focus:ring-forsion-500 transition-all" 
                  placeholder="Enter username"
                  required 
                  disabled={isAuthLoading}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-dark-muted uppercase mb-1.5 ml-1">Password</label>
                <input 
                  type="password" 
                  value={registerPassword} 
                  onChange={(e) => setRegisterPassword(e.target.value)} 
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-forsion-500 focus:ring-1 focus:ring-forsion-500 transition-all" 
                  placeholder="Enter password (min 4 characters)"
                  required 
                  disabled={isAuthLoading}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-dark-muted uppercase mb-1.5 ml-1">Confirm Password</label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-forsion-500 focus:ring-1 focus:ring-forsion-500 transition-all" 
                  placeholder="Confirm password"
                  required 
                  disabled={isAuthLoading}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-dark-muted uppercase mb-1.5 ml-1">
                  Invite Code <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  value={inviteCode} 
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())} 
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-forsion-500 focus:ring-1 focus:ring-forsion-500 transition-all" 
                  placeholder="Enter invite code"
                  required 
                  disabled={isAuthLoading}
                />
                <p className="mt-1 text-xs text-dark-muted ml-1">
                  An invite code is required to register
                </p>
              </div>
              
              {authError && (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
                  <p className="text-red-400 text-sm text-center font-medium">{authError}</p>
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isAuthLoading}
                className="w-full bg-white text-black hover:bg-gray-100 font-bold py-3.5 rounded-lg transition-all transform active:scale-[0.98] shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {isAuthLoading ? 'Registering...' : 'Register'}
              </button>
              
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError('');
                    setRegisterUsername('');
                    setRegisterPassword('');
                    setConfirmPassword('');
                    setInviteCode('');
                  }}
                  className="text-dark-muted hover:text-white text-sm transition-colors"
                >
                  Already have an account? <span className="text-forsion-400 font-medium">Sign In</span>
                </button>
              </div>
            </form>
          )}
          
          <p className="mt-6 text-center text-xs text-dark-muted">
            {authMode === 'login' ? 'Contact an administrator to request access.' : 'Need an invite code? Contact an administrator.'}
          </p>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const currentModel = allModels.find(m => m.id === selectedModelId) || allModels[0] || {
    id: 'no-model',
    name: 'No Model Configured',
    provider: 'external' as const,
    description: 'Please configure a model in settings',
    icon: 'Box'
  };
  const isNotion = themePreset === 'notion';
  const isMonet = themePreset === 'monet';
  const appBackground = isNotion
    ? 'bg-notion-bg dark:bg-notion-darkbg'
    : isMonet
      ? 'bg-desktop-surface'
      : theme === 'dark'
        ? 'bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.25),_rgba(2,6,23,0.95))]'
        : 'bg-[radial-gradient(140%_140%_at_50%_-10%,_rgba(255,255,255,0.98),_rgba(231,238,255,0.9)_45%,_rgba(214,234,255,0.92)_65%,_rgba(247,250,255,0.95))]';

  return (
    <div className={`relative flex h-screen overflow-hidden font-sans transition-colors duration-500 ${appBackground}`}>
      {!isNotion && !isMonet && theme === 'light' && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_transparent)] opacity-80 blur-3xl z-0" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(255,182,193,0.25),_transparent)_0_0/50%_50%,_radial-gradient(circle_at_80%_0%,_rgba(147,197,253,0.3),_transparent)_0_0/60%_60%] opacity-70 blur-2xl z-0" />
          <div className="pointer-events-none absolute inset-0 bg-[conic-gradient(from_90deg,_rgba(255,255,255,0.35),_transparent_45%)] opacity-60 blur-3xl z-0" />
        </>
      )}
      <Sidebar
        sessions={sessions.filter(s => !s.archived)}
        archivedSessions={sessions.filter(s => s.archived)}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={createNewSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onArchiveSession={archiveSession}
        onUpdateSessionEmoji={updateSessionEmoji}
        user={user}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        themePreset={themePreset}
      />

      <div className={`relative z-10 flex-1 flex flex-col w-full transition-colors duration-300 ${isNotion ? 'bg-notion-bg dark:bg-notion-darkbg' : 'bg-transparent'}`}>
        {/* Header */}
        <header className={`h-16 border-b flex items-center justify-between px-4 md:px-6 z-10 gap-3 backdrop-blur ${
           isNotion 
             ? 'bg-notion-bg/80 dark:bg-notion-darkbg/95 border-notion-border dark:border-notion-darkborder'
             : isMonet
               ? 'bg-white/10 border-b border-white/10 shadow-sm'
               : 'bg-gradient-to-r from-white/80 via-slate-50/70 to-white/80 dark:from-[#0f172a]/70 dark:via-[#0b1120]/70 dark:to-[#020617]/70 border-white/10 dark:border-slate-800'
        }`}>
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-gray-500 dark:text-dark-muted hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-dark-card rounded-lg">
             <Menu size={20} />
          </button>

          <div className="relative flex-1 md:flex-none">
             <button onClick={() => setModelDropdownOpen(!modelDropdownOpen)} className={`flex items-center gap-2 font-medium px-3 py-2 rounded-lg transition-colors w-full md:w-auto ${
               isNotion 
                 ? 'hover:bg-gray-100 dark:hover:bg-notion-darksidebar text-gray-900 dark:text-white'
                 : isMonet
                   ? 'hover:bg-white/40 text-[#4A4B6A]'
                   : 'hover:bg-slate-100 dark:hover:bg-dark-card text-gray-900 dark:text-white'
             }`}>
                <span className={`truncate font-semibold ${isNotion ? 'font-serif' : isMonet ? 'font-cursive text-xl' : 'text-forsion-600 dark:text-forsion-400'}`}>{currentModel.name}</span>
                <ChevronDown size={14} className={`transition-transform flex-shrink-0 text-[#4A4B6A]/80 ${modelDropdownOpen ? 'rotate-180' : ''}`} />
             </button>

             {modelDropdownOpen && (
               <div className={`absolute top-full left-0 mt-2 w-72 rounded-xl shadow-xl py-2 z-50 max-h-[80vh] overflow-y-auto ring-1 ring-black/5 ${
                 isNotion
                   ? 'bg-white dark:bg-notion-darksidebar border border-notion-border dark:border-notion-darkborder'
                   : isMonet
                     ? 'glass-dark backdrop-blur-xl'
                     : 'bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border'
               }`}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-dark-muted uppercase tracking-wider">Select Model</div>
                   {allModels.length === 0 ? (
                     <div className="px-4 py-6 text-center">
                       <div className="text-gray-400 dark:text-dark-muted text-sm mb-2">No models configured</div>
                       <div className="text-xs text-gray-500 dark:text-gray-500">
                         Enable Developer Mode in Settings to add models, or contact admin.
                       </div>
                     </div>
                   ) : (
                     allModels.map(model => (
                       <button key={model.id} onClick={() => { hasManualModelSelection.current = true; setSelectedModelId(model.id); setModelDropdownOpen(false); }} className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                         selectedModelId === model.id 
                           ? (isNotion ? 'bg-gray-100 dark:bg-black/30' : 'bg-slate-100 dark:bg-white/5')
                           : 'hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}>
                        <div className="mt-1">
                          <ModelAvatarIcon model={model} />
                        </div>
                        <div className="overflow-hidden">
                          <div className={`text-sm font-medium truncate ${
                             selectedModelId === model.id 
                               ? (isNotion ? 'text-black dark:text-white font-bold' : 'text-forsion-600 dark:text-forsion-400')
                               : 'text-gray-900 dark:text-dark-text'
                          }`}>{model.name}</div>
                          <div className="text-xs text-gray-500 truncate">{model.description}</div>
                        </div>
                      </button>
                     ))
                   )}
               </div>
             )}
          </div>
          <div className={`text-xs md:text-sm hidden md:block font-medium tracking-wide ${
             isNotion ? 'text-gray-400 font-serif' : isMonet ? 'text-[#4A4B6A]/80 font-bold' : 'text-slate-400 dark:text-dark-muted'
          }`}>
            Forsion AI Studio
          </div>
        </header>

        <ChatArea 
          messages={currentSession?.messages || []} 
          isProcessing={isProcessing} 
          currentModel={currentModel} 
          allModels={allModels}
          themePreset={themePreset}
          onFileUpload={processFile}
          onRegenerateMessage={handleRegenerateMessage}
          user={user ? { username: user.username, nickname: user.nickname, avatar: user.avatar } : undefined}
        />

        {/* Input Area */}
        <div className={`p-4 border-t ${
          isNotion 
            ? 'bg-notion-bg dark:bg-notion-darkbg border-notion-border dark:border-notion-darkborder'
            : isMonet
              ? 'glass border-t border-white/10'
              : 'bg-white/5 dark:bg-[#030712]/60 backdrop-blur-xl border-white/40 dark:border-white/10'
        }`}>
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative group">
             {/* Deep Thinking and Force Image Generation Toggles */}
             <div className="flex items-center gap-4 mb-3 ml-2">
               <label className="flex items-center gap-2 cursor-pointer select-none">
                 <div className="relative">
                   <input
                     type="checkbox"
                     checked={isDeepThinking}
                     onChange={(e) => setIsDeepThinking(e.target.checked)}
                     className="sr-only peer"
                   />
                   <div className={`w-10 h-5 rounded-full transition-all ${
                     isDeepThinking
                       ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                       : isNotion
                         ? 'bg-gray-300 dark:bg-gray-600'
                         : 'bg-gray-300 dark:bg-gray-700'
                   }`}></div>
                   <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                     isDeepThinking ? 'translate-x-5' : 'translate-x-0'
                   }`}></div>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <BrainCircuit size={16} className={`${
                     isDeepThinking
                       ? 'text-purple-500 dark:text-purple-400'
                       : isNotion
                         ? 'text-gray-400 dark:text-gray-500'
                         : 'text-gray-400 dark:text-gray-500'
                   }`} />
                   <span className={`text-sm font-medium ${
                     isDeepThinking
                       ? isNotion
                         ? 'text-gray-900 dark:text-white'
                         : 'text-purple-600 dark:text-purple-400'
                       : 'text-gray-500 dark:text-gray-400'
                   }`}>
                     Deep Thinking
                   </span>
                 </div>
               </label>
               {isDeepThinking && (
                 <span className={`text-xs px-2 py-0.5 rounded-full ${
                   isNotion
                     ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                     : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300'
                 }`}>
                   Enhanced reasoning enabled
                 </span>
               )}
               
               {/* Force Image Generation Toggle */}
               <label className="flex items-center gap-2 cursor-pointer select-none">
                 <div className="relative">
                   <input
                     type="checkbox"
                     checked={forceImageGeneration}
                     onChange={(e) => setForceImageGeneration(e.target.checked)}
                     className="sr-only peer"
                   />
                   <div className={`w-10 h-5 rounded-full transition-all ${
                     forceImageGeneration
                       ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                       : isNotion
                         ? 'bg-gray-300 dark:bg-gray-600'
                         : 'bg-gray-300 dark:bg-gray-700'
                   }`}></div>
                   <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                     forceImageGeneration ? 'translate-x-5' : 'translate-x-0'
                   }`}></div>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <ImageIcon size={16} className={`${
                     forceImageGeneration
                       ? 'text-pink-500 dark:text-pink-400'
                       : isNotion
                         ? 'text-gray-400 dark:text-gray-500'
                         : 'text-gray-400 dark:text-gray-500'
                   }`} />
                   <span className={`text-sm font-medium ${
                     forceImageGeneration
                       ? isNotion
                         ? 'text-gray-900 dark:text-white'
                         : 'text-pink-600 dark:text-pink-400'
                       : 'text-gray-500 dark:text-gray-400'
                   }`}>
                     Force Image
                   </span>
                 </div>
               </label>
               {forceImageGeneration && (
                 <span className={`text-xs px-2 py-0.5 rounded-full ${
                   isNotion
                     ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                     : 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300'
                 }`}>
                   Will generate image
                 </span>
               )}
             </div>

             {/* Attachment Preview */}
             {attachment && (
               <div className="absolute bottom-full left-0 mb-3 ml-2">
                 <div className="relative group/preview inline-block">
                    {attachment.type === 'image' ? (
                      <>
                        <img 
                          src={attachment.url} 
                          alt="Preview" 
                          className={`h-20 w-auto rounded-lg shadow-lg object-cover ${isNotion ? 'border border-gray-300' : 'border border-gray-200 dark:border-dark-border bg-gray-100'}`} 
                        />
                        {/* Image editing hint */}
                        <div className={`absolute top-full left-0 mt-2 px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${
                          isNotion 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700' 
                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}>
                          💡 Try: /edit or /img2img commands
                        </div>
                      </>
                    ) : (
                      <div className={`h-20 px-4 rounded-lg shadow-lg flex items-center gap-3 ${isNotion ? 'border border-gray-300 bg-gray-100' : 'border border-gray-200 dark:border-dark-border bg-gray-100 dark:bg-gray-800'}`}>
                        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="overflow-hidden max-w-[120px]">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{attachment.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {attachment.mimeType.includes('pdf') ? 'PDF' : 
                             attachment.mimeType.includes('word') ? 'Word' : 
                             attachment.mimeType.includes('text') ? 'Text' : 'Document'}
                          </div>
                        </div>
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={clearAttachment} 
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                    >
                      <XIcon size={12} />
                    </button>
                 </div>
               </div>
             )}

             <div className={`relative flex items-end gap-2 p-2 transition-all ${
               isNotion
                 ? 'bg-transparent border-t-0 border-b-2 border-gray-200 dark:border-gray-700 rounded-none focus-within:border-black dark:focus-within:border-white'
                 : isMonet
                   ? 'bg-white/40 border border-white/30 rounded-[2rem] shadow-sm focus-within:ring-2 focus-within:ring-white/30 backdrop-blur-md'
                   : 'bg-white/80 dark:bg-white/10 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_80px_rgba(2,6,23,0.75)] border border-white/60 dark:border-white/15 focus-within:ring-2 focus-within:ring-forsion-400/40 dark:focus-within:ring-cyan-400/20'
             }`}>
               <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.txt,.md" className="hidden" />
               <button 
                 type="button"
                 onClick={() => fileInputRef.current?.click()}
                 className={`p-3 rounded-full transition-all duration-300 flex-shrink-0 self-end ${
                    isNotion 
                      ? 'text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                      : isMonet
                        ? 'text-[#4A4B6A]/70 hover:text-[#4A4B6A] hover:bg-white/50'
                        : 'text-slate-500 hover:text-forsion-400 dark:text-slate-300 dark:hover:text-cyan-200 hover:bg-white/60 dark:hover:bg-white/10 border border-transparent dark:border-white/10 shadow-sm'
                 } hover:-translate-y-0.5 active:scale-95 shadow-sm`}
                 title="Attach File"
               >
                 <Paperclip size={20} />
               </button>

               <div className="relative flex-1">
                 <textarea
                   ref={textareaRef}
                   value={input}
                   onChange={(e) => {
                     setInput(e.target.value);
                     // Update cursor position for command autocomplete
                     const cursorPos = e.target.selectionStart || 0;
                     setCursorPosition(cursorPos);
                     
                     // Show command autocomplete when '/' is typed
                     const textBeforeCursor = e.target.value.substring(0, cursorPos);
                     const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
                     const showAutocomplete = lastSlashIndex !== -1 && 
                       (cursorPos === lastSlashIndex + 1 || 
                        textBeforeCursor.substring(lastSlashIndex + 1).match(/^[a-z]*$/i));
                     setShowCommandAutocomplete(showAutocomplete);
                     
                     // Auto-resize textarea
                     if (textareaRef.current) {
                       textareaRef.current.style.height = 'auto';
                       textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
                     }
                   }}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       setShowCommandAutocomplete(false);
                       handleSendMessage();
                     } else if (e.key === 'Escape') {
                       setShowCommandAutocomplete(false);
                     } else if (showCommandAutocomplete && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab')) {
                       // Let CommandAutocomplete handle these keys
                       return;
                     }
                   }}
                   onSelect={(e) => {
                     const target = e.target as HTMLTextAreaElement;
                     setCursorPosition(target.selectionStart || 0);
                   }}
                   onClick={(e) => {
                     const target = e.target as HTMLTextAreaElement;
                     setCursorPosition(target.selectionStart || 0);
                   }}
                   placeholder={`Message ${currentModel.name}...`}
                   disabled={isProcessing}
                   rows={1}
                   className={`w-full bg-transparent py-3 px-2 focus:outline-none placeholder-slate-400 dark:placeholder-gray-600 resize-none overflow-y-auto ${
                      isNotion 
                        ? 'text-gray-900 dark:text-white font-serif' 
                        : isMonet
                          ? 'text-[#4A4B6A] dark:text-white placeholder-slate-500'
                          : 'text-slate-800 dark:text-gray-100'
                   }`}
                   style={{ maxHeight: '200px' }}
                 />
                 
                 {/* Command Autocomplete */}
                 {showCommandAutocomplete && (
                   <CommandAutocomplete
                     input={input}
                     cursorPosition={cursorPosition}
                     onSelect={(command) => {
                       const textBeforeCursor = input.substring(0, cursorPosition);
                       const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
                       if (lastSlashIndex !== -1) {
                         const newInput = input.substring(0, lastSlashIndex) + command + ' ' + input.substring(cursorPosition);
                         setInput(newInput);
                         setShowCommandAutocomplete(false);
                         // Focus back to textarea
                         setTimeout(() => {
                           if (textareaRef.current) {
                             const newCursorPos = lastSlashIndex + command.length + 1;
                             textareaRef.current.focus();
                             textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                             setCursorPosition(newCursorPos);
                           }
                         }, 0);
                       }
                     }}
                     onClose={() => setShowCommandAutocomplete(false)}
                     isNotion={isNotion}
                   />
                 )}
               </div>
               
               {/* Expand Button */}
               <button 
                 type="button"
                 onClick={() => { setExpandedInput(input); setIsInputExpanded(true); }}
                 className={`p-2 rounded-full transition-all duration-300 flex-shrink-0 self-end ${
                    isNotion 
                      ? 'text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                      : isMonet
                        ? 'text-[#4A4B6A]/70 hover:text-[#4A4B6A] hover:bg-white/50'
                        : 'text-slate-500 hover:text-forsion-400 dark:text-slate-300 dark:hover:text-cyan-200 hover:bg-white/60 dark:hover:bg-white/10'
                 }`}
                 title="Expand Input"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
               </button>
               
               {isProcessing ? (
                 <button 
                   type="button"
                   onClick={handleStopGeneration}
                   className={`p-3 transition-all ${
                      isNotion 
                        ? 'text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                        : isMonet
                          ? 'bg-red-500/80 hover:bg-red-600/80 text-white rounded-2xl shadow-sm'
                          : 'bg-gradient-to-r from-red-500 to-red-600 dark:from-red-500/80 dark:to-red-600/80 rounded-2xl text-white hover:from-red-400 hover:to-red-500 dark:hover:from-red-400/80 dark:hover:to-red-500/80 shadow-lg shadow-red-500/30 dark:shadow-[0_15px_40px_rgba(239,68,68,0.4)] border border-white/30 dark:border-white/10'
                   } hover:-translate-y-0.5 active:scale-95`}
                   title="Stop generation"
                 >
                   <Square size={20} fill="currentColor" />
                 </button>
               ) : (
                 <button 
                   type="submit"
                   disabled={(!input.trim() && !attachment)}
                   className={`p-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isNotion 
                        ? 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white'
                        : isMonet
                          ? 'bg-[#3E406F] hover:bg-[#5A5C8A] text-white rounded-2xl shadow-md'
                          : 'bg-gradient-to-r from-forsion-500 to-indigo-500 dark:from-sky-500/80 dark:to-indigo-500/80 rounded-2xl text-white hover:from-forsion-400 hover:to-indigo-400 dark:hover:from-sky-400/80 dark:hover:to-indigo-400/80 shadow-lg shadow-forsion-500/30 dark:shadow-[0_15px_40px_rgba(15,23,42,0.65)] border border-white/30 dark:border-white/10'
                   } hover:-translate-y-0.5 active:scale-95`}
                 >
                   <Send size={20} />
                 </button>
               )}
             </div>
          </form>
          <div className={`text-center text-xs mt-3 font-medium ${isMonet ? 'text-[#4A4B6A]/60' : 'text-slate-400 dark:text-dark-muted'}`}>
            AI can make mistakes. Please verify important information.
          </div>
        </div>
      </div>

      {showRegisterModal && (
        <RegisterModal
          onClose={() => setShowRegisterModal(false)}
          onSuccess={handleRegisterSuccess}
        />
      )}
      
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          userRole={user!.role} 
          user={user!}
          currentTheme={theme} 
          onThemeChange={(t) => updateAppSettings({ theme: t })}
          currentPreset={themePreset}
          onPresetChange={(p) => updateAppSettings({ themePreset: p })}
          onModelsChange={syncSettingsFromBackend}
          onUpdateSettings={updateAppSettings}
          isOffline={isOfflineMode}
          onReconnect={attemptReconnect}
        />
      )}
      
      {/* Expanded Input Modal with bounce animation */}
      {isInputExpanded && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setIsInputExpanded(false)}
        >
          <div 
            className={`w-full max-w-4xl h-[70vh] flex flex-col rounded-2xl shadow-2xl transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] animate-[modalBounce_0.5s_ease-out] ${
              isNotion 
                ? 'bg-notion-bg dark:bg-notion-darkbg border border-notion-border dark:border-notion-darkborder'
                : 'bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border'
            }`}
            style={{
              animation: 'modalBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <style>{`
              @keyframes modalBounce {
                0% {
                  opacity: 0;
                  transform: scale(0.3) translateY(100px);
                }
                50% {
                  opacity: 1;
                  transform: scale(1.05) translateY(-10px);
                }
                70% {
                  transform: scale(0.95) translateY(5px);
                }
                100% {
                  transform: scale(1) translateY(0);
                }
              }
            `}</style>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Compose Message</h3>
              <button 
                onClick={() => setIsInputExpanded(false)}
                className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <XIcon size={20} />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-hidden">
              <textarea
                value={expandedInput}
                onChange={(e) => setExpandedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    setInput(expandedInput);
                    setIsInputExpanded(false);
                    setTimeout(() => handleSendMessage(), 100);
                  }
                }}
                placeholder={`Message ${currentModel.name}... (Ctrl+Enter to send)`}
                className={`w-full h-full bg-transparent focus:outline-none resize-none text-lg leading-relaxed ${
                  isNotion 
                    ? 'text-gray-900 dark:text-white font-serif placeholder-gray-400'
                    : 'text-slate-800 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600'
                }`}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-dark-border">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Press Ctrl+Enter to send directly
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsInputExpanded(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setInput(expandedInput);
                    setIsInputExpanded(false);
                    if (textareaRef.current) {
                      textareaRef.current.style.height = 'auto';
                      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
                    }
                  }}
                  className={`px-6 py-2 font-semibold rounded-lg transition-all transform hover:scale-105 active:scale-95 ${
                    isNotion
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100'
                      : 'bg-gradient-to-r from-forsion-500 to-indigo-500 text-white hover:from-forsion-400 hover:to-indigo-400 shadow-lg'
                  }`}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
