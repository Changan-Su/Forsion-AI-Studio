
import React, { useEffect, useRef, useState } from 'react';
import { Message, AIModel } from '../types';
import { Bot, User, Cpu, AlertCircle, BrainCircuit, ChevronDown, UploadCloud } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatAreaProps {
  messages: Message[];
  isProcessing: boolean;
  currentModel: AIModel;
  themePreset: 'default' | 'notion';
  onFileUpload: (file: File) => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({ messages, isProcessing, currentModel, themePreset, onFileUpload }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Drag and Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Support images and documents
      const supportedTypes = [
        'image/',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown'
      ];
      
      const isSupported = supportedTypes.some(type => 
        file.type.startsWith(type) || file.type === type
      );
      
      if (isSupported) {
        onFileUpload(file);
      } else {
        alert('Supported files: Images, PDF, Word (.doc, .docx), Text files');
      }
    }
  };

  // Styling helpers based on themePreset
  const isNotion = themePreset === 'notion';

  if (messages.length === 0) {
    return (
      <div 
        className={`flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden ${
          isNotion 
            ? 'bg-notion-bg dark:bg-notion-darkbg'
            : 'bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.97),_rgba(228,238,255,0.92))] dark:bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.25),_#030712)]'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        
        {isDragging && (
           <div className="absolute inset-0 bg-forsion-500/10 dark:bg-forsion-500/20 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-dashed border-forsion-400 rounded-xl m-4">
             <div className="text-center animate-bounce">
                <UploadCloud size={64} className="text-forsion-600 dark:text-forsion-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-forsion-700 dark:text-forsion-200">Drop file here</h3>
                <p className="text-sm text-forsion-600 dark:text-forsion-300 mt-2">Images, PDF, Word, Text files</p>
             </div>
           </div>
        )}

        <div className={`relative w-20 h-20 rounded-3xl flex items-center justify-center mb-8 animate-fade-in-up ${
           isNotion 
             ? 'bg-gray-100 dark:bg-notion-darksidebar border border-notion-border dark:border-notion-darkborder shadow-sm' 
             : 'bg-gradient-to-tr from-forsion-500 to-indigo-600 shadow-2xl shadow-forsion-500/20'
        }`}>
          <Bot size={40} className={isNotion ? "text-gray-800 dark:text-gray-200" : "text-white"} />
        </div>
        <h2 className={`text-3xl font-bold mb-3 tracking-tight ${
           isNotion 
             ? 'text-gray-900 dark:text-white font-serif' 
             : 'text-transparent bg-clip-text bg-gradient-to-r from-forsion-600 to-indigo-600 dark:from-forsion-400 dark:to-indigo-400'
        }`}>
          Forsion AI Studio
        </h2>
        <p className={`text-center max-w-md text-lg ${
           isNotion ? 'text-gray-500 dark:text-gray-400 font-serif italic' : 'text-slate-500 dark:text-gray-400'
        }`}>
          Start a conversation with <span className={`font-semibold ${isNotion ? 'text-gray-800 dark:text-gray-200 underline decoration-dotted' : 'text-forsion-600 dark:text-forsion-400'}`}>{currentModel.name}</span>.
        </p>
      </div>
    );
  }

  return (
    <div 
      className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scroll-smooth transition-colors duration-300 relative ${
        isNotion 
          ? 'bg-notion-bg dark:bg-notion-darkbg'
          : 'bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(227,238,255,0.9))] dark:bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.25),_#030712)]'
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      {/* Drag Overlay */}
      {isDragging && (
         <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-dashed border-forsion-500 m-4 rounded-xl pointer-events-none">
           <div className="text-center">
              <UploadCloud size={64} className="text-forsion-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Drop to upload</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Images, PDF, Word, Text files</p>
           </div>
         </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-4 max-w-4xl mx-auto group ${
            msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          {/* Avatar */}
          <div
            className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center shadow-md ${
              isNotion 
                ? (msg.role === 'user' ? 'bg-gray-800 dark:bg-white text-white dark:text-black' : 'bg-transparent border border-gray-300 dark:border-gray-600')
                : (msg.role === 'user' ? 'bg-forsion-600 text-white' : msg.isError ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white border-2 border-white dark:border-gray-800')
            }`}
          >
            {msg.role === 'user' ? (
              <User size={18} />
            ) : msg.isError ? (
              <AlertCircle size={18} />
            ) : (
              <Cpu size={18} className={isNotion ? "text-gray-800 dark:text-gray-200" : ""} />
            )}
          </div>

          <div
            className={`flex flex-col max-w-[85%] ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`px-5 py-4 transition-all duration-200 ${
                isNotion
                  ? 'rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-700 ' + (msg.role === 'user' ? 'bg-gray-100 dark:bg-notion-darksidebar text-gray-900 dark:text-white' : 'bg-transparent text-gray-900 dark:text-white pl-0')
                      : `rounded-2xl shadow-sm ${msg.role === 'user' 
                        ? 'bg-gradient-to-br from-forsion-500 via-indigo-500 to-indigo-600 text-white rounded-[26px] rounded-tr-2xl border border-white/30 shadow-[0_20px_45px_rgba(79,70,229,0.35)]'
                      : msg.isError
                        ? 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                        : 'bg-white/80 text-slate-800 border border-white/70 backdrop-blur-md dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 rounded-tl-sm shadow-[0_15px_45px_rgba(15,23,42,0.08)] dark:shadow-none'}`
              }`}
            >
              {/* User Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {msg.attachments.map((att, idx) => (
                    <div key={idx} className="relative overflow-hidden rounded-lg border border-white/20 dark:border-gray-600 max-w-[200px]">
                      {att.type === 'image' && (
                        <img src={att.url} alt="Uploaded attachment" className="w-full h-auto object-cover" />
                      )}
                      {att.type === 'document' && (
                        <div className="p-3 bg-white/10 dark:bg-gray-800 flex items-center gap-2">
                          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium truncate">{att.name || 'Document'}</div>
                            <div className="text-xs opacity-70">{att.mimeType.split('/')[1]?.toUpperCase()}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reasoning Block */}
              {msg.reasoning && (
                <details className="mb-4 group/reasoning">
                  <summary className={`flex items-center gap-2 cursor-pointer text-xs font-bold uppercase tracking-wider mb-2 select-none list-none ${
                    isNotion 
                      ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded w-fit' 
                      : 'text-slate-500 dark:text-forsion-300 hover:text-forsion-600 dark:hover:text-forsion-200'
                  }`}>
                     <BrainCircuit size={14} />
                     <span>Deep Thinking</span>
                     <ChevronDown size={14} className="group-open/reasoning:rotate-180 transition-transform" />
                  </summary>
                  <div className={`pl-3 border-l-2 text-sm italic whitespace-pre-wrap leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200 rounded-r-md ${
                    isNotion 
                      ? 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-notion-darksidebar p-3 font-serif'
                      : 'border-forsion-200 dark:border-gray-600/50 text-slate-600 dark:text-gray-400 bg-slate-50/50 dark:bg-gray-900/30 p-2'
                  }`}>
                    {msg.reasoning}
                  </div>
                </details>
              )}

              {/* Main Content (Generated Image) */}
              {msg.imageUrl && (
                 <div className="mb-3">
                   <img src={msg.imageUrl} alt="Generated Content" className="rounded-xl max-w-full border border-gray-200 dark:border-gray-600 shadow-md" />
                 </div>
              )}
              
              {/* Main Text Content */}
              {msg.content && (
                 <div className={`prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed 
                    ${isNotion 
                        ? 'prose-headings:font-serif prose-headings:font-bold prose-p:font-serif prose-p:leading-7 dark:prose-invert prose-blockquote:border-l-black dark:prose-blockquote:border-l-white' 
                        : (msg.role === 'user' 
                          ? 'prose-headings:text-white prose-p:text-white prose-strong:text-white prose-a:text-white/90' 
                          : 'dark:prose-invert prose-p:text-slate-700 dark:prose-p:text-gray-200 prose-headings:text-slate-900 dark:prose-headings:text-white prose-strong:text-slate-900 dark:prose-strong:text-white prose-code:text-forsion-700 dark:prose-code:text-forsion-300 prose-code:bg-slate-100 dark:prose-code:bg-gray-700 prose-code:px-1 prose-code:rounded prose-a:text-forsion-600')
                    }`}>
                   <ReactMarkdown>{msg.content}</ReactMarkdown>
                 </div>
              )}
            </div>
            
            <span className={`text-[10px] font-medium mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
              msg.role === 'user' ? 'text-slate-400' : 'text-slate-400'
            }`}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      ))}

      {isProcessing && (
        <div className="flex gap-4 max-w-4xl mx-auto">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
             isNotion ? 'bg-white border border-gray-300 dark:border-gray-600' : 'bg-indigo-600 shadow-md'
          }`}>
             <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${
                isNotion ? 'border-gray-800 dark:border-white' : 'border-white'
             }`}></div>
          </div>
          <div className="flex items-center">
            <span className={`text-sm animate-pulse font-medium px-4 py-2 rounded-full ${
               isNotion 
                 ? 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 font-serif' 
                 : 'text-slate-500 dark:text-gray-400 bg-white dark:bg-gray-800 shadow-sm border border-slate-100 dark:border-gray-700'
            }`}>
              Processing request...
            </span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatArea;