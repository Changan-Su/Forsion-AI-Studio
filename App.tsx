
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, ChatSession, Message, AIModel, AppSettings, UserRole, Attachment } from './types';
import { login, register } from './services/authService';
import { backendService } from './services/backendService'; // New backend
import { generateGeminiResponse } from './services/geminiService';
import { generateExternalResponse } from './services/externalApiService';
import { BUILTIN_MODELS, getAllModels, STORAGE_KEYS } from './constants';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import { Send, Zap, Menu, Sparkles, MessageSquare, Code, Brain, BrainCircuit, Image as ImageIcon, ChevronDown, Paperclip, X as XIcon, Box } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // App State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string>(BUILTIN_MODELS[0].id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  
  // Theme & Settings
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // Default to Light
  const [themePreset, setThemePreset] = useState<'default' | 'notion'>('default');
  const [customModels, setCustomModels] = useState<AIModel[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Media Upload State
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Initial Load (Backend Simulation)
  useEffect(() => {
    const initApp = async () => {
      // 1. Load User
      const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (storedUser) setUser(JSON.parse(storedUser));
      
      // 2. Load Sessions
      const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (storedSessions) setSessions(JSON.parse(storedSessions));

      // 3. Load Settings from Backend
      try {
        const settings = await backendService.getSettings();
        setAppSettings(settings);
        setTheme(settings.theme || 'light');
        setThemePreset(settings.themePreset || 'default');
        setCustomModels(settings.customModels || []);
      } catch (e) {
        console.error("Failed to load settings from backend", e);
      }
    };

    initApp();
  }, []);

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
    const bodyClass = theme === 'dark' 
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
    if (!appSettings) return;
    const updated = { ...appSettings, ...newSettings };
    setAppSettings(updated);
    
    // Optimistic UI updates
    if (newSettings.theme) setTheme(newSettings.theme);
    if (newSettings.themePreset) setThemePreset(newSettings.themePreset);
    if (newSettings.customModels) setCustomModels(newSettings.customModels);

    // Sync with backend
    await backendService.updateSettings(updated);
  };

  // Combined Model List
  const allModels = getAllModels(customModels);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      const success = await register(username, password);
      if (success) {
        setAuthMode('login');
        setAuthError('');
        alert('Registration successful! Please login.');
      } else {
        setAuthError('Username already exists');
      }
    } catch (err) {
      setAuthError('Registration failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setCurrentSessionId(null);
    setIsSidebarOpen(false);
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

  // File Handler
  const processFile = (file: File) => {
    const reader = new FileReader();
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
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAttachment = () => setAttachment(null);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !attachment) || isProcessing) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createNewSession();
    }

    const currentModel = allModels.find(m => m.id === selectedModelId) || allModels[0];
    const currentAttachments = attachment ? [attachment] : [];
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      attachments: currentAttachments,
      timestamp: Date.now(),
    };

    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          messages: [...s.messages, userMessage],
          title: s.messages.length === 0 ? input.substring(0, 30) || 'Chat' : s.title,
          updatedAt: Date.now()
        };
      }
      return s;
    }));

    setInput('');
    setAttachment(null);
    setIsProcessing(true);

    try {
      let responseText = "";
      let responseReasoning: string | undefined;
      let responseImage: string | undefined;
      const session = sessions.find(s => s.id === sessionId);

      // Use settings from state (which is synced with backend)
      const configKey = currentModel.configKey || currentModel.id;
      const config = appSettings?.externalApiConfigs?.[configKey];

      if (currentModel.provider === 'gemini') {
         // Gemini Logic
         const history = currentModel.id === 'gemini-2.5-flash-image' ? [] : 
            (session?.messages || []).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
         
         const result = await generateGeminiResponse(currentModel.id, userMessage.content, history, config?.apiKey, currentAttachments);
         responseText = result.text;
         responseImage = result.imageUrl;
         responseReasoning = result.reasoning;

      } else {
        // External Logic
        if (!config || !config.apiKey) {
           throw new Error(`API Key for ${currentModel.name} is missing in Admin Settings.`);
        } else {
           const history = (session?.messages || []).map(m => ({
               role: m.role === 'model' ? 'assistant' : m.role === 'user' ? 'user' : 'system',
               content: m.content
           }));
           history.push({ role: 'user', content: userMessage.content });

           const apiModelId = currentModel.apiModelId || currentModel.id;
           const result = await generateExternalResponse(config, apiModelId, history, currentModel.defaultBaseUrl, currentAttachments);
           responseText = result.content;
           responseReasoning = result.reasoning;
        }
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        reasoning: responseReasoning,
        imageUrl: responseImage,
        timestamp: Date.now()
      };

      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return { ...s, messages: [...s.messages, botMessage], updatedAt: Date.now() };
        }
        return s;
      }));

    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: `Error: ${error.message}`,
        timestamp: Date.now(),
        isError: true
      };
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return { ...s, messages: [...s.messages, errorMessage] };
        }
        return s;
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
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

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
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
              {isAuthLoading ? 'Processing...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
          
          <div className="mt-8 flex justify-center">
             <button 
                onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }} 
                className="text-forsion-400 hover:text-forsion-300 text-sm transition-colors font-medium"
             >
                {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
             </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const currentModel = allModels.find(m => m.id === selectedModelId) || allModels[0];
  const isNotion = themePreset === 'notion';

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-300 ${isNotion ? 'bg-notion-bg dark:bg-notion-darkbg' : 'bg-slate-50 dark:bg-dark-bg'}`}>
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={createNewSession}
        onDeleteSession={deleteSession}
        user={user}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettings(true)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className={`flex-1 flex flex-col relative w-full transition-colors duration-300 ${isNotion ? 'bg-notion-bg dark:bg-notion-darkbg' : 'bg-white dark:bg-dark-bg'}`}>
        {/* Header */}
        <header className={`h-16 border-b flex items-center justify-between px-4 md:px-6 z-10 gap-3 backdrop-blur ${
           isNotion 
             ? 'bg-notion-bg/80 dark:bg-notion-darkbg/95 border-notion-border dark:border-notion-darkborder'
             : 'bg-white/80 dark:bg-dark-bg/95 border-gray-200 dark:border-dark-border'
        }`}>
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-gray-500 dark:text-dark-muted hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-dark-card rounded-lg">
             <Menu size={20} />
          </button>

          <div className="relative flex-1 md:flex-none">
             <button onClick={() => setModelDropdownOpen(!modelDropdownOpen)} className={`flex items-center gap-2 font-medium px-3 py-2 rounded-lg transition-colors w-full md:w-auto ${
               isNotion 
                 ? 'hover:bg-gray-100 dark:hover:bg-notion-darksidebar text-gray-900 dark:text-white'
                 : 'hover:bg-slate-100 dark:hover:bg-dark-card text-gray-900 dark:text-white'
             }`}>
                <span className={`truncate font-semibold ${isNotion ? 'font-serif' : 'text-forsion-600 dark:text-forsion-400'}`}>{currentModel.name}</span>
                <ChevronDown size={14} className={`transition-transform flex-shrink-0 text-gray-500 ${modelDropdownOpen ? 'rotate-180' : ''}`} />
             </button>

             {modelDropdownOpen && (
               <div className={`absolute top-full left-0 mt-2 w-72 rounded-xl shadow-xl py-2 z-50 max-h-[80vh] overflow-y-auto ring-1 ring-black/5 ${
                 isNotion
                   ? 'bg-white dark:bg-notion-darksidebar border border-notion-border dark:border-notion-darkborder'
                   : 'bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border'
               }`}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-dark-muted uppercase tracking-wider">Select Model</div>
                  {allModels.map(model => (
                    <button key={model.id} onClick={() => { setSelectedModelId(model.id); setModelDropdownOpen(false); }} className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                       selectedModelId === model.id 
                         ? (isNotion ? 'bg-gray-100 dark:bg-black/30' : 'bg-slate-100 dark:bg-white/5')
                         : 'hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}>
                      <div className="mt-1 text-gray-500 dark:text-dark-muted">{getModelIcon(model.icon)}</div>
                      <div className="overflow-hidden">
                        <div className={`text-sm font-medium truncate ${
                           selectedModelId === model.id 
                             ? (isNotion ? 'text-black dark:text-white font-bold' : 'text-forsion-600 dark:text-forsion-400')
                             : 'text-gray-900 dark:text-dark-text'
                        }`}>{model.name}</div>
                        <div className="text-xs text-gray-500 truncate">{model.description}</div>
                      </div>
                    </button>
                  ))}
               </div>
             )}
          </div>
          <div className={`text-xs md:text-sm hidden md:block font-medium tracking-wide ${
             isNotion ? 'text-gray-400 font-serif' : 'text-slate-400 dark:text-dark-muted'
          }`}>
            Forsion AI Studio
          </div>
        </header>

        <ChatArea 
          messages={currentSession?.messages || []} 
          isProcessing={isProcessing} 
          currentModel={currentModel} 
          themePreset={themePreset}
          onFileUpload={processFile}
        />

        {/* Input Area */}
        <div className={`p-4 border-t ${
          isNotion 
            ? 'bg-notion-bg dark:bg-notion-darkbg border-notion-border dark:border-notion-darkborder'
            : 'bg-white dark:bg-dark-bg border-gray-200 dark:border-dark-border'
        }`}>
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative group">
             {/* Attachment Preview */}
             {attachment && (
               <div className="absolute bottom-full left-0 mb-3 ml-2">
                 <div className="relative group/preview inline-block">
                    <img 
                      src={attachment.url} 
                      alt="Preview" 
                      className={`h-20 w-auto rounded-lg shadow-lg object-cover ${isNotion ? 'border border-gray-300' : 'border border-gray-200 dark:border-dark-border bg-gray-100'}`} 
                    />
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
                 : 'bg-slate-50 dark:bg-dark-card rounded-3xl shadow-inner border border-slate-200 dark:border-dark-border focus-within:ring-2 focus-within:ring-forsion-500/50 focus-within:border-forsion-500'
             }`}>
               <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
               <button 
                 type="button"
                 onClick={() => fileInputRef.current?.click()}
                 className={`p-3 transition-colors rounded-full ${
                    isNotion 
                      ? 'text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                      : 'text-slate-400 hover:text-forsion-600 dark:text-dark-muted dark:hover:text-forsion-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                 }`}
                 title="Attach Image"
               >
                 <Paperclip size={20} />
               </button>

               <input
                 type="text"
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 placeholder={`Message ${currentModel.name}...`}
                 disabled={isProcessing}
                 className={`w-full bg-transparent py-3 px-2 focus:outline-none placeholder-slate-400 dark:placeholder-gray-600 ${
                    isNotion ? 'text-gray-900 dark:text-white font-serif' : 'text-slate-800 dark:text-gray-100'
                 }`}
               />
               
               <button 
                 type="submit"
                 disabled={(!input.trim() && !attachment) || isProcessing}
                 className={`p-3 transition-colors disabled:opacity-50 ${
                    isNotion 
                      ? 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white'
                      : 'bg-forsion-600 rounded-2xl text-white hover:bg-forsion-500 disabled:hover:bg-forsion-600 shadow-md shadow-forsion-600/20'
                 }`}
               >
                 <Send size={20} />
               </button>
             </div>
          </form>
          <div className="text-center text-xs text-slate-400 dark:text-dark-muted mt-3 font-medium">
            AI can make mistakes. Please verify important information.
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          userRole={user!.role} 
          username={user!.username} 
          currentTheme={theme} 
          onThemeChange={(t) => updateAppSettings({ theme: t })}
          currentPreset={themePreset}
          onPresetChange={(p) => updateAppSettings({ themePreset: p })}
          onModelsChange={() => {
            // Re-fetch handled by appSettings state update in modal
            backendService.getSettings().then(s => setCustomModels(s.customModels || []));
          }}
        />
      )}
    </div>
  );
};

export default App;
