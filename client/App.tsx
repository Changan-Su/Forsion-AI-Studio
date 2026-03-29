
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, ChatSession, Message, AIModel, AppSettings, UserRole, Attachment, AgentConfig, AgentDefaults, AgentStatusEvent } from './types';
import { backendService, API_ROOT } from './services/backendService'; // New backend
import { generateGeminiResponse, generateGeminiResponseStream } from './services/geminiService';
import { generateExternalResponse, generateExternalResponseStream } from './services/externalApiService';
import { BUILTIN_MODELS, DEFAULT_MODEL_ID, getAllModels, getConfiguredModels, STORAGE_KEYS } from './constants';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import { Send, Zap, Menu, Sparkles, MessageSquare, Code, Brain, BrainCircuit, Image as ImageIcon, ChevronDown, Paperclip, X as XIcon, Box, Square, UploadCloud, Bot, FolderOpen } from 'lucide-react';
import { getPresetAvatar, svgToDataUrl } from './src/utils/presetAvatars';
import { detectImageGenerationIntent, generateImage, detectImageEditIntent, editImage, imageToImage } from './services/imageGenerationService';
import CommandAutocomplete from './components/CommandAutocomplete';
import type { Command } from './components/CommandAutocomplete';
import { getAllBuiltinSkills } from './services/skillsRegistry';
import AgentConfigPanel from './components/AgentConfigPanel';
import AgentStatusBar from './components/AgentStatusBar';
import WorkspacePanel from './components/WorkspacePanel';
import { runAgentLoop } from './services/agentRuntime';
import { workspaceService } from './services/workspaceService';
import { chatSyncService } from './services/chatSyncService';
import { compressImage } from './services/imageUtils';
import { AnimatePresence, AnimatedModalBackdrop, AnimatedModalContent, AnimatedDropdown, motion } from './components/AnimatedUI';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

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
  const selectedModelIdRef = useRef(selectedModelId);

  useEffect(() => {
    selectedModelIdRef.current = selectedModelId;
  }, [selectedModelId]);

  // Theme & Settings
  const [theme, setTheme] = useState<'light' | 'dark'>('dark'); // Default to Dark
  const [themePreset, setThemePreset] = useState<'default' | 'notion' | 'monet' | 'apple' | 'forsion1'>('apple');
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
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileSizeError, setFileSizeError] = useState<{ name: string; size: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Drag and Drop State for Input Area
  const [isDraggingOverInput, setIsDraggingOverInput] = useState(false);
  const dragCounterInput = useRef(0);
  
  // Expanded Input Modal State
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Agent State
  const [showAgentConfig, setShowAgentConfig] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatusEvent | null>(null);
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false);

  // Mobile UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentSessionForSkills = sessions.find(s => s.id === currentSessionId);
  const skillCommands = useMemo<Command[]>(() => {
    const ids = currentSessionForSkills?.agentConfig?.enabledSkillIds ?? [];
    if (ids.length === 0) return [];
    const allSkills = getAllBuiltinSkills();
    return ids.map(id => {
      const skill = allSkills.find(s => s.id === id);
      if (!skill) return null;
      return {
        command: `/${skill.id}`,
        description: `Use ${skill.name} skill`,
        category: 'skill' as const,
      };
    }).filter(Boolean) as Command[];
  }, [currentSessionForSkills?.agentConfig?.enabledSkillIds]);

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

  const handleUnifiedLogin = useCallback(() => {
    setIsAuthLoading(true);
    const redirectUrl = encodeURIComponent(window.location.href);
    window.location.href = `${API_ROOT}/auth?redirect=${redirectUrl}`;
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
      // Read latest user from localStorage to avoid stale closure issues
      const currentUserStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
      
      if (currentUser && (settings.nickname !== undefined || settings.avatar !== undefined)) {
        const updatedUser = {
          ...currentUser,
          nickname: settings.nickname !== undefined ? settings.nickname : currentUser.nickname,
          avatar: settings.avatar !== undefined ? settings.avatar : currentUser.avatar
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
        // For global models using OpenAI-compatible API:
        // - Images are generally supported (GPT-4V style)
        // - PDF/Documents are NOT natively supported by OpenAI API, need text extraction
        supportsFileUpload: m.supportsFileUpload ?? true, // Support image upload
        supportedFileTypes: m.supportedFileTypes || ['image/*'], // Only images by default for OpenAI-compatible APIs
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
      const selectedModelIdSnapshot = selectedModelIdRef.current;
      if (!hasManualModelSelection.current) {
        setSelectedModelId(preferredModel);
      } else if (defaultModelChanged && selectedModelIdSnapshot === previousDefaultModelId.current) {
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
      const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        try {
          const currentUser = await backendService.getCurrentUser();
          setUser(currentUser);
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
        } catch (error: any) {
          if (error?.code === 'AUTH_REQUIRED' || error?.name === 'AuthRequiredError') {
            handleUnifiedLogin();
            return;
          }
          setAuthError('Failed to validate session.');
          setIsAuthLoading(false);
          return;
        }
      }
      
      const defaultAgentConfig: AgentConfig = {
        systemPrompt: '',
        enabledSkillIds: [],
        mcpServers: [],
        maxIterations: 10,
      };
      const normalizeSessions = (list: ChatSession[]) => list.map(s => ({
        ...s,
        agentConfig: s.agentConfig ? {
          ...s.agentConfig,
          mcpServers: (s.agentConfig.mcpServers || []).map(srv => ({ ...srv, status: 'disconnected' as const })),
        } : defaultAgentConfig,
      }));

      let localSessions: ChatSession[] = [];
      const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (storedSessions) {
        localSessions = normalizeSessions(JSON.parse(storedSessions));
      }

      const remoteSessions = await chatSyncService.fetchSessionList();
      const merged = chatSyncService.mergeSessionLists(localSessions, normalizeSessions(remoteSessions));
      setSessions(merged);

      if (localSessions.length > 0 && remoteSessions.length === 0) {
        chatSyncService.bulkUpload(localSessions).catch(() => {});
      }

      const storedSessionId = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION_ID);
      if (storedSessionId && merged.find(s => s.id === storedSessionId)) {
        setCurrentSessionId(storedSessionId);
      }

      await syncSettingsFromBackend();
      setIsAuthLoading(false);
    };

    const authToken = new URLSearchParams(window.location.search).get('token');
    if (authToken) {
      localStorage.setItem('auth_token', authToken);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('token');
      window.history.replaceState({}, '', currentUrl.toString());
    }

    initApp();
  }, []);

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
    const bodyClassMap: Record<string, string> = {
      monet: 'bg-desktop-surface',
      apple: theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100',
      forsion1: theme === 'dark' ? 'bg-zinc-900' : 'bg-[#edeae5]',
      notion: theme === 'dark' ? 'bg-notion-darkbg' : 'bg-notion-bg',
      default: theme === 'dark' ? 'bg-dark-bg' : 'bg-white',
    };
    const bodyClass = bodyClassMap[themePreset] || bodyClassMap.default;
      
    document.body.className = `${bodyClass} transition-colors duration-300`;

  }, [theme, themePreset]);

  // Persist Sessions locally (could move to backend too in future)
  // Guard against overwriting stored sessions with the initial empty state on first render
  const sessionsInitialized = useRef(false);
  useEffect(() => {
    if (sessions.length === 0 && !sessionsInitialized.current) return;
    sessionsInitialized.current = true;

    // Strip large base64 data from attachments to avoid localStorage quota (~5MB).
    // Images have already been sent to the model; only metadata is needed for history display.
    const sanitized = sessions.map(s => ({
      ...s,
      messages: s.messages.map(m => ({
        ...m,
        attachments: m.attachments?.map(a => ({
          ...a,
          url: a.url && a.url.startsWith('data:') ? '' : a.url,
          extractedText: a.extractedText && a.extractedText.length > 10000
            ? a.extractedText.substring(0, 10000) + '\n...(truncated)'
            : a.extractedText,
        })),
      })),
    }));

    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sanitized));
    } catch (e) {
      console.warn('Failed to save sessions to localStorage:', e);
    }
  }, [sessions]);

  // Persist current session ID and lazy-load messages from server if needed
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION_ID, currentSessionId);

      const session = sessions.find(s => s.id === currentSessionId);
      if (session && session.messages.length === 0) {
        chatSyncService.fetchSessionMessages(currentSessionId).then(messages => {
          if (messages.length > 0) {
            setSessions(prev => prev.map(s =>
              s.id === currentSessionId ? { ...s, messages } : s
            ));
          }
        }).catch(() => {});
      }
    }
  }, [currentSessionId]);

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
  const handleLogout = () => {
    clearAuthState();
  };

  // Chat Handlers
  const createNewSession = useCallback(() => {
    const defaults = appSettings?.agentDefaults;
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      modelId: selectedModelId,
      messages: [],
      updatedAt: Date.now(),
      agentConfig: {
        systemPrompt: defaults?.systemPrompt ?? '',
        enabledSkillIds: [...(defaults?.enabledSkillIds ?? [])],
        mcpServers: (defaults?.mcpServers ?? []).map(s => ({ ...s, status: 'disconnected' as const })),
        maxIterations: defaults?.maxIterations ?? 10,
      },
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    return newSession.id;
  }, [selectedModelId, appSettings]);

  // File Handler with support for documents
  // Helper to check if provider supports native document upload (PDF/Word)
  const providerSupportsDocuments = (provider?: string): boolean => {
    // Based on backend documentation, providers that support native document upload:
    // - gemini: natively supports PDF/Word
    // - Others (openai, anthropic, deepseek, etc.): only support images, not documents
    return provider === 'gemini';
  };

  // Helper to check if current model supports file upload for a given type
  const modelSupportsFileType = (mimeType: string): boolean => {
    const model = allModels.find(m => m.id === selectedModelId);
    if (!model?.supportsFileUpload) return false;
    if (!model.supportedFileTypes) return true; // If no types specified, assume all supported
    
    return model.supportedFileTypes.some(pattern => {
      if (pattern.endsWith('/*')) {
        // Wildcard pattern like 'image/*'
        const prefix = pattern.slice(0, -1); // 'image/'
        return mimeType.startsWith(prefix);
      }
      return mimeType === pattern;
    });
  };

  const processFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setFileSizeError({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1),
      });
      return;
    }

    // Ensure a session exists so we can write to workspace
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createNewSession();
    }

    const wsPath = `uploads/${Date.now()}-${file.name}`;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isWord = file.type === 'application/msword' || 
                   file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isText = file.type === 'text/plain' || file.type === 'text/markdown';

    // Save file to workspace (IndexedDB)
    try {
      const arrayBuffer = await file.arrayBuffer();
      await workspaceService.writeFile(sessionId, wsPath, arrayBuffer, file.type);
    } catch (error) {
      console.warn('[processFile] Failed to write to workspace:', error);
    }

    // Read data URL for in-memory use (display + API calls)
    const readAsDataUrl = (): Promise<string> => new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = (e) => resolve(e.target!.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    
    if (isImage) {
      const rawDataUrl = await readAsDataUrl();
      const dataUrl = await compressImage(rawDataUrl);
      setAttachments(prev => [...prev, {
        type: 'image', url: dataUrl, workspacePath: wsPath, mimeType: file.type, name: file.name,
      }]);
    } else if (isText) {
      const textContent = await file.text();
      setAttachments(prev => [...prev, {
        type: 'document', url: '', workspacePath: wsPath, mimeType: file.type, name: file.name,
        extractedText: textContent,
      }]);
    } else if (isPdf || isWord) {
      const model = allModels.find(m => m.id === selectedModelId);
      const provider = model?.provider || 'external';
      const providerSupportsDocUpload = providerSupportsDocuments(provider);
      const modelSupportsFileUpload = model?.supportsFileUpload ?? false;
      const shouldUseNativeUpload = providerSupportsDocUpload || (modelSupportsFileUpload && modelSupportsFileType(file.type));
      
      if (shouldUseNativeUpload) {
        const dataUrl = await readAsDataUrl();
        setAttachments(prev => [...prev, {
          type: 'document', url: dataUrl, workspacePath: wsPath, mimeType: file.type, name: file.name,
        }]);
      } else {
        let extractedText = '';
        let dataUrl = '';
        try {
          const result = await backendService.parseFile(file);
          if (result.text) extractedText = result.text;
          if (result.base64) dataUrl = `data:${file.type};base64,${result.base64}`;
        } catch {
          dataUrl = await readAsDataUrl();
          try {
            const result = await backendService.parseBase64(dataUrl, file.name, file.type);
            if (result.text) extractedText = result.text;
          } catch {
            extractedText = isPdf
              ? `[PDF Document: ${file.name}]\n\nNote: Text extraction requires backend support.`
              : `[Word Document: ${file.name}]\n\nNote: Text extraction requires backend support.`;
          }
        }
        setAttachments(prev => [...prev, {
          type: 'document', url: dataUrl, workspacePath: wsPath, mimeType: file.type, name: file.name,
          extractedText,
        }]);
      }
    } else {
      alert('Unsupported file type. Please upload images, PDFs, Word documents, or text files.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Process all selected files
      const files = Array.from(e.target.files);
      for (const file of files) {
        await processFile(file);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAttachment = (index?: number) => {
    if (index !== undefined) {
      // Remove specific attachment by index
      setAttachments(prev => prev.filter((_, i) => i !== index));
    } else {
      // Clear all attachments
      setAttachments([]);
    }
  };

  // Drag and Drop Handlers for Input Area
  const handleInputDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterInput.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOverInput(true);
    }
  };

  const handleInputDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterInput.current--;
    if (dragCounterInput.current === 0) {
      setIsDraggingOverInput(false);
    }
  };

  const handleInputDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleInputDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverInput(false);
    dragCounterInput.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      // Support images and documents
      const supportedTypes = [
        'image/',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown'
      ];
      
      // Process all supported files
      const supportedFiles = files.filter(file => 
        supportedTypes.some(type => 
          file.type.startsWith(type) || file.type === type
        )
      );
      
      if (supportedFiles.length > 0) {
        // Upload all supported files
        supportedFiles.forEach(file => {
          processFile(file);
        });
      } else {
        alert('Supported files: Images, PDF, Word (.doc, .docx), Text files');
      }
    }
  };

  // Paste Handler for file attachments (images, documents)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const supportedTypes = [
      'image/',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown'
    ];

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && supportedTypes.some(type => file.type.startsWith(type) || file.type === type)) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      files.forEach(file => processFile(file));
    }
  };

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
    if ((!input.trim() && attachments.length === 0) || isProcessing) return;
    
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

    // Resolve workspace paths to data URLs for API consumption
    const currentAttachments = await Promise.all(
      attachments.map(async (a) => {
        if (!a.url && a.workspacePath && sessionId) {
          const dataUrl = await workspaceService.readFileAsDataUrl(sessionId, a.workspacePath);
          return { ...a, url: dataUrl || '' };
        }
        return { ...a };
      })
    );
    
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

    // Handle skill commands: /skillId message → prepend instruction to prioritize that skill
    const skillMatch = finalInput.match(/^\/(\w+)\s+([\s\S]*)$/);
    if (skillMatch) {
      const allSkills = getAllBuiltinSkills();
      const matchedSkill = allSkills.find(s => s.id === skillMatch[1]);
      if (matchedSkill) {
        const skillName = matchedSkill.name;
        const toolNames = matchedSkill.tools.map(t => t.name).join(', ');
        finalInput = `[Use ${skillName} skill — prioritize calling: ${toolNames}]\n\n${skillMatch[2]}`;
      }
    }
    
    // Build the user-visible message (clean, without extracted document text)
    const messageContent = finalInput;
    
    // Build the API-facing content (includes extracted text for models that need it)
    const documentAttachments = currentAttachments.filter(a => a.type === 'document' && a.extractedText);
    let apiContent = finalInput;
    if (documentAttachments.length > 0) {
      const docsText = documentAttachments.map(a => 
        `📄 Attached Document: ${a.name}\n\n${a.extractedText}`
      ).join('\n\n---\n');
      apiContent = `${finalInput}\n\n---\n${docsText}`;
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
    setAttachments([]);
    setIsProcessing(true);
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    // 检测是否为图像编辑或以图生图请求
    const imageAttachments = currentAttachments.filter(a => a.type === 'image');
    const hasImageAttachment = imageAttachments.length > 0;
    const { isEditRequest, isImg2ImgRequest, prompt: editPrompt, mode: editMode } = hasImageAttachment 
      ? detectImageEditIntent(finalInput, true)
      : { isEditRequest: false, isImg2ImgRequest: false, prompt: finalInput, mode: 'none' as const };
    
    if ((isEditRequest || isImg2ImgRequest) && hasImageAttachment) {
      // 处理图像编辑或以图生图请求 (use first image attachment)
      const imageAttachment = imageAttachments[0];
      const botMessageId = (Date.now() + 1).toString();
      const modeText = isEditRequest ? '编辑图像' : '以图生图';
      const botMessage: Message = {
        id: botMessageId,
        role: 'model',
        content: `正在${modeText}...`,
        timestamp: Date.now(),
        modelId: currentModel.id,
        editMode: editMode,
        sourceImageUrl: imageAttachment.url
      };

      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return { ...s, messages: [...s.messages, botMessage], updatedAt: Date.now() };
        }
        return s;
      }));

      try {
        let result: { imageUrl: string; usage?: { prompt_tokens: number; completion_tokens: number } };
        const imageBase64 = imageAttachment.url;
        
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

        setSessions(prev => {
          const updated = prev.find(s => s.id === sessionId);
          if (updated) chatSyncService.uploadSession(updated).catch(() => {});
          return prev;
        });
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

        setSessions(prev => {
          const updated = prev.find(s => s.id === sessionId);
          if (updated) chatSyncService.uploadSession(updated).catch(() => {});
          return prev;
        });
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

      // ── Agentic path (agent mode is always on) ──
      if (session?.agentConfig) {
        setAgentStatus({ type: 'iteration_start', iteration: 0 });
        const agentOutput = await runAgentLoop({
          sessionId: sessionId,
          userMessage: apiContent,
          attachments: currentAttachments,
          history: (session.messages || []).filter(m => m.id !== botMessageId),
          model: currentModel,
          agentConfig: session.agentConfig,
          appSettings,
          enableThinking: shouldUseDeepThinking,
          signal: abortControllerRef.current?.signal,
          onStatusUpdate: (event) => setAgentStatus(event),
          onStreamChunk: updateStreamingMessage,
          onToolMessages: (msgs) => {
            setSessions(prev => prev.map(s => {
              if (s.id !== sessionId) return s;
              const botIdx = s.messages.findIndex(m => m.id === botMessageId);
              if (botIdx < 0) return s;
              const before = s.messages.slice(0, botIdx);
              const bot = s.messages[botIdx];
              return { ...s, messages: [...before, ...msgs, bot], updatedAt: Date.now() };
            }));
          },
        });

        // Final update: set the bot message content to the final output
        setSessions(prev => prev.map(s => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            messages: s.messages.map(m =>
              m.id === botMessageId ? { ...m, content: agentOutput.finalContent, reasoning: agentOutput.reasoning } : m
            ),
            updatedAt: Date.now(),
          };
        }));

        usage = agentOutput.usage;
        setAgentStatus(null);

      } else if (currentModel.provider === 'gemini') {
         // Gemini Logic with streaming
         console.log('[handleSendMessage] Using Gemini provider for model:', currentModel.id);
         const history = currentModel.id === 'gemini-2.5-flash-image' ? [] :
            (session?.messages || []).filter(m => m.id !== botMessageId).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));

         const result = await generateGeminiResponseStream(
           currentModel.id,
           apiContent,
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
        history.push({ role: 'user', content: apiContent });

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

      setSessions(prev => {
        const updated = prev.find(s => s.id === sessionId);
        if (updated) chatSyncService.uploadSession(updated).catch(() => {});
        return prev;
      });
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
    
    const originalInput = userMessage.content;
    
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
      
      // Inject extracted text for models that don't support native document upload
      const docAtts = attachments.filter(a => a.type === 'document' && a.extractedText);
      let apiContentForRegen = content;
      if (docAtts.length > 0) {
        const docsText = docAtts.map(a => `📄 Attached Document: ${a.name}\n\n${a.extractedText}`).join('\n\n---\n');
        apiContentForRegen = `${content}\n\n---\n${docsText}`;
      }

      const historyForApi = historyMessages.slice(0, -1).map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role === 'user' ? 'user' : 'system',
        content: m.content
      }));
      historyForApi.push({ role: 'user', content: apiContentForRegen });
      
      let usage: { prompt_tokens: number; completion_tokens: number } | undefined;

      if (currentModel.provider === 'gemini') {
        const geminiHistory = currentModel.id === 'gemini-2.5-flash-image' ? [] : 
          historyMessages.slice(0, -1).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
        
        const result = await generateGeminiResponseStream(
          currentModel.id, 
          apiContentForRegen, 
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

      setSessions(prev => {
        const updated = prev.find(s => s.id === sessionId);
        if (updated) chatSyncService.uploadSession(updated).catch(() => {});
        return prev;
      });
    }
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
    workspaceService.deleteAllFiles(id).catch(() => {});
    chatSyncService.deleteSession(id).catch(() => {});
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-dark-bg to-dark-bg"></div>
        
        <div className="bg-dark-card w-full max-w-md p-8 rounded-2xl shadow-2xl border border-dark-border relative z-10 backdrop-blur-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-forsion-500 via-purple-500 to-pink-500"></div>
          
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-forsion-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-forsion-500/20">
              <span className="text-3xl font-bold text-white">F</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Forsion AI Studio</h1>
            <p className="text-dark-muted text-sm">Enterprise Grade AI Platform</p>
          </div>

          {authError && (
            <div className="p-3 mb-4 bg-red-900/20 border border-red-900/50 rounded-lg">
              <p className="text-red-400 text-sm text-center font-medium">{authError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleUnifiedLogin}
            disabled={isAuthLoading}
            className="w-full bg-white text-black hover:bg-gray-100 font-bold py-3.5 rounded-lg transition-all transform active:scale-[0.98] shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isAuthLoading ? 'Redirecting...' : 'Continue with Forsion Account'}
          </button>

          <p className="mt-6 text-center text-xs text-dark-muted">
            You will be redirected to the unified Forsion login page.
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
  const isApple = themePreset === 'apple';
  const isForsion1 = themePreset === 'forsion1';
  const appBackground = isNotion
    ? 'bg-notion-bg dark:bg-notion-darkbg'
    : isMonet
      ? 'bg-desktop-surface'
      : isApple
        ? 'bg-apple-surface'
        : isForsion1
          ? 'bg-forsion1-surface'
          : theme === 'dark'
            ? 'bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.25),_rgba(2,6,23,0.95))]'
            : 'bg-[radial-gradient(140%_140%_at_50%_-10%,_rgba(255,255,255,0.98),_rgba(231,238,255,0.9)_45%,_rgba(214,234,255,0.92)_65%,_rgba(247,250,255,0.95))]';

  return (
    <div className={`relative flex h-screen overflow-hidden font-sans transition-colors duration-500 ${appBackground}`}>
      {!isNotion && !isMonet && !isApple && !isForsion1 && theme === 'light' && (
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
        <header className={`h-[52px] border-b flex items-center justify-between px-4 md:px-6 z-10 gap-3 backdrop-blur ${
           isNotion 
             ? 'bg-notion-bg/80 dark:bg-notion-darkbg/95 border-notion-border dark:border-notion-darkborder'
             : isMonet
               ? 'bg-white/10 border-b border-white/10 shadow-sm'
               : isApple
                 ? 'apple-glass border-gray-200 dark:border-gray-700/50'
                 : isForsion1
                   ? 'forsion1-glass border-[#d5d0c8] dark:border-gray-700/50'
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
                <span className={`truncate font-semibold ${isNotion ? 'font-serif' : isMonet ? 'font-cursive text-xl' : isApple ? 'text-blue-600 dark:text-blue-400' : isForsion1 ? 'text-amber-800 dark:text-amber-300' : 'text-forsion-600 dark:text-forsion-400'}`}>{currentModel.name}</span>
                <ChevronDown size={14} className={`transition-transform flex-shrink-0 text-[#4A4B6A]/80 ${modelDropdownOpen ? 'rotate-180' : ''}`} />
             </button>

             <AnimatePresence>
               {modelDropdownOpen && (
                 <AnimatedDropdown
                   key="model-dropdown"
                   origin="top-left"
                   className={`absolute top-full left-0 mt-2 w-72 rounded-xl shadow-xl py-2 z-50 max-h-[80vh] overflow-y-auto ring-1 ring-black/5 ${
                     isNotion
                       ? 'bg-white dark:bg-notion-darksidebar border border-notion-border dark:border-notion-darkborder'
                       : isMonet
                         ? 'glass-dark backdrop-blur-xl'
                         : isApple
                           ? 'apple-glass border-gray-200 dark:border-gray-700/50'
                           : isForsion1
                             ? 'forsion1-glass border-[#d5d0c8] dark:border-gray-700/50'
                             : 'bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border'
                   }`}
                 >
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
                         <button key={model.id} onClick={() => { hasManualModelSelection.current = true; setSelectedModelId(model.id); setModelDropdownOpen(false); }} className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors duration-200 ${
                           selectedModelId === model.id 
                             ? (isNotion ? 'bg-gray-100 dark:bg-black/30' : isApple ? 'bg-blue-50 dark:bg-blue-900/20' : isForsion1 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-100 dark:bg-white/5')
                             : 'hover:bg-gray-50 dark:hover:bg-white/5'
                        }`}>
                          <div className="mt-1">
                            <ModelAvatarIcon model={model} />
                          </div>
                          <div className="overflow-hidden">
                            <div className={`text-sm font-medium truncate ${
                               selectedModelId === model.id 
                                 ? (isNotion ? 'text-black dark:text-white font-bold' : isApple ? 'text-blue-600 dark:text-blue-400 font-bold' : isForsion1 ? 'text-amber-800 dark:text-amber-300 font-bold' : 'text-forsion-600 dark:text-forsion-400')
                                 : 'text-gray-900 dark:text-dark-text'
                            }`}>{model.name}</div>
                            <div className="text-xs text-gray-500 truncate">{model.description}</div>
                          </div>
                        </button>
                       ))
                     )}
                 </AnimatedDropdown>
               )}
             </AnimatePresence>
          </div>
          <div className={`text-xs md:text-sm hidden md:block font-medium tracking-wide ${
             isNotion ? 'text-gray-400 font-serif' : isMonet ? 'text-[#4A4B6A]/80 font-bold' : isApple ? 'text-gray-500 dark:text-gray-400' : isForsion1 ? 'text-stone-500 dark:text-stone-400' : 'text-slate-400 dark:text-dark-muted'
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
          sessionId={currentSessionId ?? undefined}
        />

        {/* Input Area */}
        <div className={`p-4 border-t ${
          isNotion 
            ? 'bg-notion-bg dark:bg-notion-darkbg border-notion-border dark:border-notion-darkborder'
            : isMonet
              ? 'glass border-t border-white/10'
              : isApple
                ? 'apple-glass border-gray-200 dark:border-gray-700/50'
                : isForsion1
                  ? 'forsion1-glass border-[#d5d0c8] dark:border-gray-700/50'
                  : 'bg-white/5 dark:bg-[#030712]/60 backdrop-blur-xl border-white/40 dark:border-white/10'
        }`}>
          <form 
            onSubmit={handleSendMessage} 
            className="max-w-3xl mx-auto relative group"
            onDragEnter={handleInputDragEnter}
            onDragOver={handleInputDragOver}
            onDragLeave={handleInputDragLeave}
            onDrop={handleInputDrop}
          >
             {/* Drag Overlay - Fixed over input area */}
             <AnimatePresence>
               {isDraggingOverInput && (
                 <motion.div
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                   className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none ${
                     isNotion ? 'bg-gray-50/85 dark:bg-gray-900/85 backdrop-blur-md'
                     : isMonet ? 'bg-white/40 backdrop-blur-xl'
                     : isApple ? 'bg-white/60 dark:bg-gray-900/70 backdrop-blur-xl'
                     : isForsion1 ? 'bg-[#edeae5]/70 dark:bg-[#1a1918]/80 backdrop-blur-xl'
                     : 'bg-white/50 dark:bg-[#030712]/70 backdrop-blur-xl'
                   }`}
                 >
                   <motion.div
                     initial={{ scale: 0.94, y: 6 }}
                     animate={{ scale: 1, y: 0 }}
                     exit={{ scale: 0.96, y: 4 }}
                     transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                     className={`flex flex-col items-center gap-4 px-12 py-10 border-2 border-dashed ${
                       isNotion
                         ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                         : isMonet
                           ? 'border-[#4A4B6A]/40 bg-white/60 backdrop-blur-md text-[#4A4B6A]'
                           : isApple
                             ? 'border-blue-400/60 dark:border-blue-500/40 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md text-blue-600 dark:text-blue-400'
                             : isForsion1
                               ? 'border-amber-500/60 dark:border-amber-600/40 bg-[#edeae5]/80 dark:bg-[#1a1918]/80 backdrop-blur-md text-amber-800 dark:text-amber-300'
                               : 'border-forsion-400/60 dark:border-cyan-500/40 bg-white/70 dark:bg-[#030712]/80 backdrop-blur-md text-forsion-600 dark:text-cyan-400'
                     }`}
                     style={{ borderRadius: 'var(--radius-xl)' }}
                   >
                     <UploadCloud size={48} className="opacity-90" />
                     <div className="text-center">
                       <p className="text-xl font-semibold">Drop to upload</p>
                       <p className={`text-sm mt-1 ${
                         isNotion ? 'text-gray-500 dark:text-gray-400'
                         : isMonet ? 'text-[#4A4B6A]/70'
                         : isApple ? 'text-blue-500/70 dark:text-blue-400/70'
                         : isForsion1 ? 'text-amber-700/70 dark:text-amber-400/70'
                         : 'text-gray-500 dark:text-gray-400'
                       }`}>Images, PDF, Word, Text files</p>
                     </div>
                   </motion.div>
                 </motion.div>
               )}
             </AnimatePresence>

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
                   <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm ${
                     isDeepThinking ? 'translate-x-5' : 'translate-x-0'
                   }`} style={{ transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
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
                   <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm ${
                     forceImageGeneration ? 'translate-x-5' : 'translate-x-0'
                   }`} style={{ transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
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

               {/* Agent Settings Button */}
               <button
                 type="button"
                 onClick={() => setShowAgentConfig(true)}
                 className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                   isNotion
                     ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                     : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                 }`}
                 title="Session agent settings"
               >
                 <Bot size={14} />
                 <span>Agent</span>
               </button>

               {/* Workspace Panel Toggle */}
               <button
                 type="button"
                 onClick={() => setShowWorkspacePanel(!showWorkspacePanel)}
                 className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                   showWorkspacePanel
                     ? isNotion
                       ? 'bg-gray-800 text-white'
                       : isMonet
                         ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/40'
                         : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                     : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                 }`}
                 title="Toggle workspace file browser"
               >
                 <FolderOpen size={14} />
                 <span>Files</span>
               </button>
             </div>

             {/* Agent Status Bar */}
             <AgentStatusBar
               isActive={agentStatus !== null}
               currentIteration={agentStatus?.iteration ?? 0}
               maxIterations={sessions.find(s => s.id === currentSessionId)?.agentConfig?.maxIterations ?? 10}
               currentToolName={agentStatus?.toolName}
               themePreset={themePreset}
             />

             <div
               className={`relative flex flex-col overflow-hidden ${
                 isNotion
                   ? 'bg-transparent border-t-0 border-b-2 border-gray-200 dark:border-gray-700 rounded-none focus-within:border-black dark:focus-within:border-white'
                   : isMonet
                     ? 'bg-white/40 border border-white/30 shadow-sm focus-within:ring-2 focus-within:ring-white/30 backdrop-blur-md'
                     : isApple
                       ? 'apple-glass border-gray-200 dark:border-gray-700/50 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/25'
                       : isForsion1
                         ? 'forsion1-glass border-[#d5d0c8] dark:border-gray-700/50 shadow-sm focus-within:ring-2 focus-within:ring-amber-500/25'
                         : 'bg-white/80 dark:bg-white/10 backdrop-blur-2xl shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_80px_rgba(2,6,23,0.75)] border border-white/60 dark:border-white/15 focus-within:ring-2 focus-within:ring-forsion-400/40 dark:focus-within:ring-cyan-400/20'
               }`}
               style={{
                 borderRadius: isInputExpanded ? 'var(--radius-lg)' : 'var(--radius-xl)',
                 maxHeight: isInputExpanded ? '60vh' : undefined,
                 transition: 'border-radius 0.3s cubic-bezier(0.25,0.1,0.25,1)',
               }}
             >
               {/* Attachment chips — inside the composer bubble */}
               <AnimatePresence>
                 {attachments.length > 0 && (
                   <motion.div
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     exit={{ opacity: 0, height: 0 }}
                     transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                     className="flex flex-wrap gap-2 px-3 pt-3 overflow-hidden"
                   >
                     {attachments.map((attachment, index) => (
                       <motion.div
                         key={index}
                         initial={{ opacity: 0, scale: 0.85, y: 4 }}
                         animate={{ opacity: 1, scale: 1, y: 0 }}
                         exit={{ opacity: 0, scale: 0.85 }}
                         transition={{ type: 'spring', stiffness: 400, damping: 28, delay: Math.min(index * 0.04, 0.15) }}
                         className={`group/chip flex items-center gap-2 p-1.5 pr-3 rounded-[var(--radius-sm)] flex-shrink-0 ${
                           isNotion
                             ? 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                             : isApple
                               ? 'bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 backdrop-blur-sm'
                               : isForsion1
                                 ? 'bg-stone-100/60 dark:bg-stone-800/60 border border-[#d5d0c8] dark:border-gray-700/50 backdrop-blur-sm'
                                 : 'bg-white/10 dark:bg-white/5 border border-white/15 dark:border-white/10'
                         }`}
                       >
                         {attachment.type === 'image' ? (
                           <div className="w-9 h-9 rounded-[var(--radius-xs)] overflow-hidden flex-shrink-0">
                             <img src={attachment.url} alt="" className="w-full h-full object-cover" />
                           </div>
                         ) : (
                           <div className={`w-9 h-9 rounded-[var(--radius-xs)] flex-shrink-0 flex items-center justify-center ${isNotion ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-blue-500/10'}`}>
                             <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                             </svg>
                           </div>
                         )}
                         <div className="min-w-0">
                           <p className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[90px]">{attachment.name}</p>
                           <p className="text-[10px] text-gray-500 dark:text-gray-400">
                             {attachment.type === 'image' ? 'Image' :
                              attachment.mimeType.includes('pdf') ? 'PDF' :
                              attachment.mimeType.includes('word') ? 'Word' :
                              attachment.mimeType.includes('text') ? 'Text' : 'Document'}
                           </p>
                         </div>
                         <button
                           type="button"
                           onClick={() => clearAttachment(index)}
                           className="opacity-0 group-hover/chip:opacity-100 transition-opacity duration-150 w-5 h-5 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-red-500 hover:text-white flex items-center justify-center text-gray-500 dark:text-gray-400 flex-shrink-0 ml-1"
                         >
                           <XIcon size={11} />
                         </button>
                       </motion.div>
                     ))}
                     {attachments.some(a => a.type === 'image') && (
                       <span className={`self-center text-[11px] px-2 py-1 rounded-[var(--radius-xs)] ${
                         isNotion ? 'text-gray-500 dark:text-gray-400' : 'text-blue-500 dark:text-blue-400'
                       }`}>
                         Try /edit or /img2img
                       </span>
                     )}
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Input row */}
               <div className="flex items-end gap-2 p-2">
               <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.txt,.md" multiple className="hidden" />
               <button 
                 type="button"
                 onClick={() => fileInputRef.current?.click()}
                 className={`p-3 rounded-full transition-all duration-300 flex-shrink-0 self-end ${
                    isNotion 
                      ? 'text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                      : isMonet
                        ? 'text-[#4A4B6A]/70 hover:text-[#4A4B6A] hover:bg-white/50'
                        : isApple
                          ? 'text-blue-500/70 hover:text-blue-600 dark:text-blue-400/70 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                          : isForsion1
                            ? 'text-amber-700/70 hover:text-amber-800 dark:text-amber-400/70 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
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
                   onPaste={handlePaste}
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
                     if (e.key === 'Enter' && !e.shiftKey && !isInputExpanded) {
                       e.preventDefault();
                       setShowCommandAutocomplete(false);
                       handleSendMessage();
                     } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && isInputExpanded) {
                       e.preventDefault();
                       setIsInputExpanded(false);
                       handleSendMessage();
                     } else if (e.key === 'Escape') {
                       setShowCommandAutocomplete(false);
                       if (isInputExpanded) setIsInputExpanded(false);
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
                   placeholder={isInputExpanded ? `Message ${currentModel.name}... (Ctrl+Enter to send)` : `Message ${currentModel.name}...`}
                   disabled={isProcessing}
                   rows={1}
                   className={`w-full bg-transparent py-3 px-2 focus:outline-none placeholder-slate-400 dark:placeholder-gray-600 resize-none overflow-y-auto transition-[max-height] duration-300 ${
                      isNotion 
                        ? 'text-gray-900 dark:text-white font-serif' 
                        : isMonet
                          ? 'text-[#4A4B6A] dark:text-white placeholder-slate-500'
                          : isApple
                            ? 'text-gray-900 dark:text-gray-100'
                            : isForsion1
                              ? 'text-stone-800 dark:text-stone-100'
                              : 'text-slate-800 dark:text-gray-100'
                   }`}
                   style={{ maxHeight: isInputExpanded ? '50vh' : '200px' }}
                 />
                 
                 {/* Command Autocomplete */}
                 {showCommandAutocomplete && (
                   <CommandAutocomplete
                     input={input}
                     cursorPosition={cursorPosition}
                     extraCommands={skillCommands}
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
                 onClick={() => setIsInputExpanded(prev => !prev)}
                 className={`p-2 rounded-full transition-all duration-300 flex-shrink-0 self-end ${
                    isNotion 
                      ? 'text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                      : isMonet
                        ? 'text-[#4A4B6A]/70 hover:text-[#4A4B6A] hover:bg-white/50'
                        : isApple
                          ? 'text-blue-500/60 hover:text-blue-600 dark:text-blue-400/60 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                          : isForsion1
                            ? 'text-amber-700/60 hover:text-amber-800 dark:text-amber-400/60 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            : 'text-slate-500 hover:text-forsion-400 dark:text-slate-300 dark:hover:text-cyan-200 hover:bg-white/60 dark:hover:bg-white/10'
                 }`}
                 title={isInputExpanded ? 'Collapse' : 'Expand Input'}
               >
                 <svg
                   xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   style={{ transform: isInputExpanded ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.25,0.1,0.25,1)' }}
                 >
                   <polyline points="15 3 21 3 21 9"></polyline>
                   <polyline points="9 21 3 21 3 15"></polyline>
                   <line x1="21" y1="3" x2="14" y2="10"></line>
                   <line x1="3" y1="21" x2="10" y2="14"></line>
                 </svg>
               </button>
               
               {isProcessing ? (
                 <button 
                   type="button"
                   onClick={handleStopGeneration}
                   style={{ borderRadius: 'var(--radius-md)' }}
                   className={`p-3 transition-all ${
                      isNotion 
                        ? 'text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                        : isMonet
                          ? 'bg-red-500/80 hover:bg-red-600/80 text-white shadow-sm'
                          : 'bg-gradient-to-r from-red-500 to-red-600 dark:from-red-500/80 dark:to-red-600/80 text-white hover:from-red-400 hover:to-red-500 dark:hover:from-red-400/80 dark:hover:to-red-500/80 shadow-lg shadow-red-500/30 dark:shadow-[0_15px_40px_rgba(239,68,68,0.4)] border border-white/30 dark:border-white/10'
                   } hover:-translate-y-0.5 active:scale-[0.97]`}
                   title="Stop generation"
                 >
                   <Square size={20} fill="currentColor" />
                 </button>
               ) : (
                  <button 
                    type="submit"
                    disabled={(!input.trim() && attachments.length === 0)}
                    style={{ borderRadius: 'var(--radius-md)' }}
                    className={`p-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isNotion 
                        ? 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white'
                        : isMonet
                          ? 'bg-[#3E406F] hover:bg-[#5A5C8A] text-white shadow-md'
                          : isApple
                            ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-400/30'
                            : isForsion1
                              ? 'bg-amber-700 hover:bg-amber-800 text-white shadow-md shadow-amber-700/20 border border-amber-600/30'
                              : 'bg-gradient-to-r from-forsion-500 to-indigo-500 dark:from-sky-500/80 dark:to-indigo-500/80 text-white hover:from-forsion-400 hover:to-indigo-400 dark:hover:from-sky-400/80 dark:hover:to-indigo-400/80 shadow-lg shadow-forsion-500/30 dark:shadow-[0_15px_40px_rgba(15,23,42,0.65)] border border-white/30 dark:border-white/10'
                   } hover:-translate-y-0.5 active:scale-[0.97]`}
                 >
                   <Send size={20} />
                 </button>
               )}
               </div>{/* end input row */}

               {/* Expanded footer — shown only when expanded */}
               {isInputExpanded && (
                 <div className={`flex items-center justify-between px-4 py-2.5 border-t text-xs ${
                   isNotion
                     ? 'border-notion-border dark:border-notion-darkborder text-gray-400 dark:text-gray-500'
                     : 'border-white/10 dark:border-white/[0.06] text-slate-400 dark:text-gray-500'
                 }`}>
                   <span>Ctrl+Enter to send &middot; Esc to collapse</span>
                   <button
                     type="button"
                     onClick={() => setIsInputExpanded(false)}
                     className={`px-3 py-1 rounded-[var(--radius-xs)] transition-colors font-medium ${
                       isNotion
                         ? 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                         : 'hover:bg-white/10 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-white'
                     }`}
                   >
                     Collapse
                   </button>
                 </div>
               )}
             </div>{/* end composer bubble */}
          </form>
          <div className={`text-center text-xs mt-3 font-medium ${isMonet ? 'text-[#4A4B6A]/60' : 'text-slate-400 dark:text-dark-muted'}`}>
            AI can make mistakes. Please verify important information.
          </div>
        </div>
      </div>

       <AnimatePresence>
         {showSettings && (
           <SettingsModal
             key="settings-modal"
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
       </AnimatePresence>

       <AnimatePresence>
         {showAgentConfig && currentSessionId && (
           <AgentConfigPanel
             key="agent-config-panel"
             sessionId={currentSessionId}
             agentConfig={sessions.find(s => s.id === currentSessionId)?.agentConfig}
             globalDefaults={appSettings?.agentDefaults}
             onSave={(config) => {
               setSessions(prev => prev.map(s =>
                 s.id === currentSessionId ? { ...s, agentConfig: config } : s
               ));
             }}
             onSkillsChanged={() => {
               setShowAgentConfig(false);
               setTimeout(() => setShowAgentConfig(true), 0);
             }}
             onClose={() => setShowAgentConfig(false)}
             themePreset={themePreset}
           />
         )}
       </AnimatePresence>

       <AnimatePresence>
         {showWorkspacePanel && currentSessionId && (
           <WorkspacePanel
             key="workspace-panel"
             sessionId={currentSessionId}
             isOpen={showWorkspacePanel}
             onClose={() => setShowWorkspacePanel(false)}
             themePreset={themePreset}
           />
         )}
       </AnimatePresence>

      
      {/* File Size Error Dialog */}
      <AnimatePresence>
        {fileSizeError && (
          <AnimatedModalBackdrop
            key="file-size-error"
            onClose={() => setFileSizeError(null)}
            className="bg-black/50 backdrop-blur-sm"
            zIndex={70}
          >
            <AnimatedModalContent
              className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center ${
                isNotion
                  ? 'bg-notion-bg dark:bg-notion-darkbg border border-notion-border dark:border-notion-darkborder'
                  : 'bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border'
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className={`text-lg font-bold mb-2 ${
                isNotion ? 'text-gray-900 dark:text-white font-serif' : 'text-gray-900 dark:text-white'
              }`}>
                文件过大
              </h3>
              <p className={`text-sm mb-1 ${isNotion ? 'text-gray-600 dark:text-gray-400 font-serif' : 'text-gray-600 dark:text-gray-400'}`}>
                <span className="font-medium text-gray-800 dark:text-gray-200">{fileSizeError.name}</span>
              </p>
              <p className={`text-sm mb-5 ${isNotion ? 'text-gray-500 dark:text-gray-400 font-serif' : 'text-gray-500 dark:text-gray-400'}`}>
                文件大小 {fileSizeError.size}MB，超过 10MB 限制。请压缩后重试。
              </p>
              <button
                onClick={() => setFileSizeError(null)}
                className={`w-full py-2.5 rounded-xl font-semibold transition-all active:scale-[0.97] ${
                  isNotion
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100'
                    : isMonet
                      ? 'bg-[#3E406F] hover:bg-[#5A5C8A] text-white'
                      : 'bg-gradient-to-r from-forsion-500 to-indigo-500 text-white hover:from-forsion-400 hover:to-indigo-400 shadow-lg'
                }`}
              >
                我知道了
              </button>
            </AnimatedModalContent>
          </AnimatedModalBackdrop>
        )}
      </AnimatePresence>

    </div>
  );
};

export default App;
