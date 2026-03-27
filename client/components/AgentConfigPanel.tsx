import React, { useState, useEffect } from 'react';
import { X, Bot, Trash2, Plus, RefreshCw, Globe, Code2, Zap, CheckCircle2, XCircle, Loader2, Wrench, Pencil, RotateCcw } from 'lucide-react';
import { AgentConfig, AgentDefaults, McpServerConfig, SkillDefinition, CustomSkillDefinition } from '../types';
import { connectMcpServer, disconnectMcpServer } from '../services/mcpClient';
import { getAllBuiltinSkills } from '../services/skillsRegistry';
import { listWorkspaceSkills, saveWorkspaceSkill, deleteWorkspaceSkill, migrateLocalStorageSkills } from '../services/agentWorkspace';
import { parsedToCustomSkill, customSkillToParsed } from '../services/skillParser';
import SkillEditor from './SkillEditor';

interface AgentConfigPanelProps {
  sessionId: string;
  agentConfig: AgentConfig | undefined;
  globalDefaults?: AgentDefaults;
  onSave: (config: AgentConfig) => void;
  onSkillsChanged?: () => void;
  onClose: () => void;
  themePreset: 'default' | 'notion' | 'monet';
}

const DEFAULT_CONFIG: AgentConfig = {
  systemPrompt: '',
  enabledSkillIds: [],
  mcpServers: [],
  maxIterations: 10,
};

const SKILL_ICONS: Record<string, React.ElementType> = {
  Globe,
  Code2,
  Zap,
  Wrench,
};

const AgentConfigPanel: React.FC<AgentConfigPanelProps> = ({
  sessionId,
  agentConfig,
  globalDefaults,
  onSave,
  onClose,
  themePreset,
  onSkillsChanged,
}) => {
  const [config, setConfig] = useState<AgentConfig>(agentConfig ?? DEFAULT_CONFIG);
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [editingSkill, setEditingSkill] = useState<CustomSkillDefinition | null>(null);
  const [showSkillEditor, setShowSkillEditor] = useState(false);

  const [workspaceSkills, setWorkspaceSkills] = useState<SkillDefinition[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);

  const allSkills: SkillDefinition[] = [...getAllBuiltinSkills(), ...workspaceSkills];

  useEffect(() => {
    let cancelled = false;
    setLoadingSkills(true);
    migrateLocalStorageSkills(sessionId)
      .then(() => listWorkspaceSkills(sessionId))
      .then((skills) => {
        if (!cancelled) {
          setWorkspaceSkills(skills);
          setLoadingSkills(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingSkills(false);
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  const isNotion = themePreset === 'notion';
  const isMonet = themePreset === 'monet';

  const accentClass = isNotion
    ? 'text-gray-800 dark:text-gray-200'
    : isMonet
      ? 'text-rose-600 dark:text-rose-300'
      : 'text-cyan-400';

  const isInherited = (field: 'systemPrompt' | 'maxIterations' | 'enabledSkillIds' | 'mcpServers'): boolean => {
    if (!globalDefaults) return false;
    switch (field) {
      case 'systemPrompt':
        return (config.systemPrompt ?? '') === (globalDefaults.systemPrompt ?? '');
      case 'maxIterations':
        return config.maxIterations === globalDefaults.maxIterations;
      case 'enabledSkillIds':
        return JSON.stringify([...config.enabledSkillIds].sort()) === JSON.stringify([...globalDefaults.enabledSkillIds].sort());
      case 'mcpServers':
        return config.mcpServers.length === globalDefaults.mcpServers.length &&
          config.mcpServers.every((s, i) => s.url === globalDefaults.mcpServers[i]?.url && s.name === globalDefaults.mcpServers[i]?.name);
    }
  };

  const resetToGlobal = (field: 'systemPrompt' | 'maxIterations' | 'enabledSkillIds' | 'mcpServers') => {
    if (!globalDefaults) return;
    switch (field) {
      case 'systemPrompt':
        setConfig(prev => ({ ...prev, systemPrompt: globalDefaults.systemPrompt }));
        break;
      case 'maxIterations':
        setConfig(prev => ({ ...prev, maxIterations: globalDefaults.maxIterations }));
        break;
      case 'enabledSkillIds':
        setConfig(prev => ({ ...prev, enabledSkillIds: [...globalDefaults.enabledSkillIds] }));
        break;
      case 'mcpServers':
        setConfig(prev => ({ ...prev, mcpServers: globalDefaults.mcpServers.map(s => ({ ...s, status: 'disconnected' as const })) }));
        break;
    }
  };

  const inheritedBadge = (field: 'systemPrompt' | 'maxIterations' | 'enabledSkillIds' | 'mcpServers') => {
    if (!globalDefaults) return null;
    if (isInherited(field)) {
      return <span className="text-[10px] opacity-40 ml-2">from global</span>;
    }
    return (
      <button
        onClick={() => resetToGlobal(field)}
        className="text-[10px] opacity-40 hover:opacity-80 ml-2 flex items-center gap-0.5 transition-opacity"
        title="Reset to global default"
      >
        <RotateCcw size={9} /> reset
      </button>
    );
  };

  const toggleSkill = (skillId: string) => {
    setConfig((prev) => ({
      ...prev,
      enabledSkillIds: prev.enabledSkillIds.includes(skillId)
        ? prev.enabledSkillIds.filter((id) => id !== skillId)
        : [...prev.enabledSkillIds, skillId],
    }));
  };

  const addMcpServer = () => {
    if (!newMcpName.trim() || !newMcpUrl.trim()) return;
    const server: McpServerConfig = {
      id: `mcp_${Date.now()}`,
      name: newMcpName.trim(),
      url: newMcpUrl.trim(),
      enabled: true,
      status: 'disconnected',
    };
    setConfig((prev) => ({ ...prev, mcpServers: [...prev.mcpServers, server] }));
    setNewMcpName('');
    setNewMcpUrl('');
  };

  const removeMcpServer = (id: string) => {
    disconnectMcpServer(id);
    setConfig((prev) => ({
      ...prev,
      mcpServers: prev.mcpServers.filter((s) => s.id !== id),
    }));
  };

  const toggleMcpServer = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      mcpServers: prev.mcpServers.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  };

  const connectServer = async (server: McpServerConfig) => {
    setConnectingId(server.id);
    try {
      const client = await connectMcpServer(server);
      const tools = await client.listTools();
      setConfig((prev) => ({
        ...prev,
        mcpServers: prev.mcpServers.map((s) =>
          s.id === server.id
            ? { ...s, status: 'connected', discoveredTools: tools, lastConnectedAt: Date.now(), errorMessage: undefined }
            : s
        ),
      }));
    } catch (e) {
      setConfig((prev) => ({
        ...prev,
        mcpServers: prev.mcpServers.map((s) =>
          s.id === server.id
            ? { ...s, status: 'error', errorMessage: e instanceof Error ? e.message : String(e) }
            : s
        ),
      }));
    } finally {
      setConnectingId(null);
    }
  };

  const inputClass = isNotion
    ? 'w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400'
    : isMonet
      ? 'w-full border border-rose-200/50 dark:border-rose-800/30 rounded-lg px-3 py-2 text-sm bg-white/50 dark:bg-gray-900/50 focus:outline-none focus:ring-1 focus:ring-rose-400'
      : 'w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-900 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-gray-100';

  const sectionTitle = 'text-xs font-semibold uppercase tracking-wider opacity-60 mb-2';
  const divider = 'border-t border-gray-200 dark:border-gray-700 my-4';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${isNotion ? 'bg-white dark:bg-gray-900' : isMonet ? 'bg-rose-50 dark:bg-gray-900' : 'bg-gray-900 border border-gray-700'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bot size={18} className={accentClass} />
            <h2 className="font-semibold text-sm">Session Settings</h2>
          </div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* System Prompt */}
          <div>
            <div className="flex items-center">
              <p className={sectionTitle}>System Prompt</p>
              {inheritedBadge('systemPrompt')}
            </div>
            <textarea
              value={config.systemPrompt ?? ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, systemPrompt: e.target.value }))}
              placeholder="Optional instructions for the agent's behavior in this session…"
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className={divider} />

          {/* Skills */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <p className={sectionTitle}>Skills</p>
                {inheritedBadge('enabledSkillIds')}
              </div>
              <button
                onClick={() => { setEditingSkill(null); setShowSkillEditor(true); }}
                className="flex items-center gap-1 text-[10px] opacity-50 hover:opacity-100 transition-opacity"
              >
                <Plus size={10} /> Create Skill
              </button>
            </div>
            {loadingSkills && (
              <p className="text-xs opacity-40">Loading skills…</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {allSkills.map((skill) => {
                const enabled = config.enabledSkillIds.includes(skill.id);
                const Icon = SKILL_ICONS[skill.icon] ?? Wrench;
                const isCustom = !skill.isBuiltin;
                return (
                  <div key={skill.id} className="relative group/skill">
                    <button
                      onClick={() => toggleSkill(skill.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-all w-full ${
                        enabled
                          ? isNotion
                            ? 'border-gray-800 bg-gray-800 text-white'
                            : isMonet
                              ? 'border-rose-500 bg-rose-500/20 text-rose-700 dark:text-rose-300'
                              : 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                          : 'border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="font-medium">{skill.name}</span>
                      <span className="opacity-60 text-[10px] text-center leading-tight">{skill.description}</span>
                      {isCustom && <span className="text-[8px] opacity-40 mt-0.5">{(skill as CustomSkillDefinition).tools.length} tools</span>}
                    </button>
                    {isCustom && (
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover/skill:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingSkill(parsedToCustomSkill(skill as any)); setShowSkillEditor(true); }}
                          className="p-1 rounded bg-black/40 text-white hover:bg-black/60"
                          title="Edit skill"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteWorkspaceSkill(sessionId, skill.id).then(() => {
                              setWorkspaceSkills(prev => prev.filter(s => s.id !== skill.id));
                            }).catch(console.error);
                            setConfig(prev => ({ ...prev, enabledSkillIds: prev.enabledSkillIds.filter(id => id !== skill.id) }));
                            onSkillsChanged?.();
                          }}
                          className="p-1 rounded bg-black/40 text-red-300 hover:bg-black/60"
                          title="Delete skill"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={divider} />

          {/* MCP Servers */}
          <div>
            <div className="flex items-center">
              <p className={sectionTitle}>MCP Servers</p>
              {inheritedBadge('mcpServers')}
            </div>
            <div className="space-y-2 mb-3">
              {config.mcpServers.map((server) => {
                const isConnecting = connectingId === server.id;
                return (
                  <div
                    key={server.id}
                    className="flex items-start gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{server.name}</span>
                        {server.status === 'connected' ? (
                          <CheckCircle2 size={11} className="text-green-400 shrink-0" />
                        ) : server.status === 'error' ? (
                          <XCircle size={11} className="text-red-400 shrink-0" />
                        ) : isConnecting ? (
                          <Loader2 size={11} className="text-yellow-400 animate-spin shrink-0" />
                        ) : null}
                        {server.discoveredTools?.length ? (
                          <span className="opacity-50">{server.discoveredTools.length} tools</span>
                        ) : null}
                      </div>
                      <div className="opacity-50 truncate mt-0.5">{server.url}</div>
                      {server.errorMessage && (
                        <div className="text-red-400 mt-0.5 text-[10px]">{server.errorMessage}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => connectServer(server)}
                        disabled={isConnecting}
                        className="opacity-60 hover:opacity-100 transition-opacity p-1"
                        title="Connect / Refresh tools"
                      >
                        <RefreshCw size={13} className={isConnecting ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => toggleMcpServer(server.id)}
                        className={`p-1 rounded transition-colors ${server.enabled ? 'opacity-100' : 'opacity-40'}`}
                        title={server.enabled ? 'Disable' : 'Enable'}
                      >
                        <span className={`inline-block w-3 h-3 rounded-full border ${server.enabled ? 'bg-green-400 border-green-400' : 'border-gray-400'}`} />
                      </button>
                      <button
                        onClick={() => removeMcpServer(server.id)}
                        className="opacity-40 hover:opacity-100 hover:text-red-400 transition-all p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                value={newMcpName}
                onChange={(e) => setNewMcpName(e.target.value)}
                placeholder="Name"
                className={`${inputClass} flex-shrink-0 w-28`}
              />
              <input
                value={newMcpUrl}
                onChange={(e) => setNewMcpUrl(e.target.value)}
                placeholder="https://… (SSE endpoint)"
                className={inputClass}
                onKeyDown={(e) => e.key === 'Enter' && addMcpServer()}
              />
              <button
                onClick={addMcpServer}
                disabled={!newMcpName.trim() || !newMcpUrl.trim()}
                className={`shrink-0 p-2 rounded-lg border transition-all disabled:opacity-30 ${isNotion ? 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800' : isMonet ? 'border-rose-300 hover:bg-rose-100 dark:border-rose-700' : 'border-gray-600 hover:bg-gray-800'}`}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className={divider} />

          {/* Max Iterations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <p className={sectionTitle}>Max Iterations</p>
                {inheritedBadge('maxIterations')}
              </div>
              <span className="text-xs font-mono font-medium">{config.maxIterations}</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={config.maxIterations}
              onChange={(e) => setConfig((prev) => ({ ...prev, maxIterations: parseInt(e.target.value) }))}
              className="w-full accent-current"
            />
            <div className="flex justify-between text-[10px] opacity-40 mt-1">
              <span>1</span>
              <span>20</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(config); onClose(); }}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${isNotion ? 'bg-gray-800 text-white hover:bg-gray-700' : isMonet ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-cyan-500 text-gray-900 hover:bg-cyan-400'}`}
          >
            Save
          </button>
        </div>
      </div>

      {showSkillEditor && (
        <SkillEditor
          skill={editingSkill ?? undefined}
          onSave={(saved) => {
            const parsedSkill = customSkillToParsed(saved);
            saveWorkspaceSkill(sessionId, parsedSkill)
              .then(() => {
                setWorkspaceSkills(prev => {
                  const idx = prev.findIndex(s => s.id === parsedSkill.id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = parsedSkill;
                    return next;
                  }
                  return [...prev, parsedSkill];
                });
              })
              .catch(console.error);
            setShowSkillEditor(false);
            setEditingSkill(null);
            onSkillsChanged?.();
          }}
          onClose={() => { setShowSkillEditor(false); setEditingSkill(null); }}
          themePreset={themePreset}
        />
      )}
    </div>
  );
};

export default AgentConfigPanel;
