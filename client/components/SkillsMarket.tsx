import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Download, Check, Plus, Globe, Code2, Zap, Wrench, Puzzle, Shield } from 'lucide-react';
import type { SkillDefinition } from '../types';
import { getAllBuiltinSkills } from '../services/skillsRegistry';
import { listWorkspaceSkills } from '../services/agentWorkspace';

const SKILL_ICONS: Record<string, React.ElementType> = {
  Globe, Code2, Zap, Wrench, Puzzle, Shield,
};

const INSTALLED_SKILLS_KEY = 'forsion_installed_skills';
const SKILL_SCOPES_KEY = 'forsion_skill_scopes';

export type SkillScope = 'global' | 'session' | 'disabled';

function getInstalledSkillIds(): string[] {
  try {
    const raw = localStorage.getItem(INSTALLED_SKILLS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const builtinIds = getAllBuiltinSkills().map(s => s.id);
  localStorage.setItem(INSTALLED_SKILLS_KEY, JSON.stringify(builtinIds));
  return builtinIds;
}

function setInstalledSkillIds(ids: string[]) {
  localStorage.setItem(INSTALLED_SKILLS_KEY, JSON.stringify(ids));
}

function getSkillScopes(): Record<string, SkillScope> {
  try {
    const raw = localStorage.getItem(SKILL_SCOPES_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function setSkillScopes(scopes: Record<string, SkillScope>) {
  localStorage.setItem(SKILL_SCOPES_KEY, JSON.stringify(scopes));
}

export function getSkillScope(skillId: string): SkillScope {
  const scopes = getSkillScopes();
  return scopes[skillId] || 'global';
}

export function getGloballyEnabledSkillIds(): string[] {
  const installed = getInstalledSkillIds();
  const scopes = getSkillScopes();
  return installed.filter(id => (scopes[id] || 'global') === 'global');
}

export type FilterType = 'all' | 'official' | 'installed';

interface SkillsMarketProps {
  themePreset: string;
  sessionId: string;
  onOpenSkillEditor?: () => void;
}

const SkillsMarket: React.FC<SkillsMarketProps> = ({
  themePreset,
  sessionId,
  onOpenSkillEditor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [installedIds, setInstalledIds] = useState<string[]>(() => getInstalledSkillIds());
  const [scopes, setScopes] = useState<Record<string, SkillScope>>(() => getSkillScopes());
  const [workspaceSkills, setWorkspaceSkills] = useState<SkillDefinition[]>([]);

  const isMonet = themePreset === 'monet';
  const isNotion = themePreset === 'notion';

  useEffect(() => {
    listWorkspaceSkills(sessionId).then(setWorkspaceSkills).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const allSkills = useMemo(() => {
    const builtins = getAllBuiltinSkills();
    return [...builtins, ...workspaceSkills.filter(ws => !ws.isWorkspace)];
  }, [workspaceSkills]);

  const filteredSkills = useMemo(() => {
    let result = allSkills;
    if (filter === 'official') result = result.filter(s => s.isBuiltin);
    if (filter === 'installed') result = result.filter(s => installedIds.includes(s.id));
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allSkills, filter, debouncedQuery, installedIds]);

  const handleInstall = useCallback((skillId: string) => {
    const next = [...installedIds, skillId];
    setInstalledIds(next);
    setInstalledSkillIds(next);
  }, [installedIds]);

  const handleUninstall = useCallback((skillId: string) => {
    const next = installedIds.filter(id => id !== skillId);
    setInstalledIds(next);
    setInstalledSkillIds(next);
  }, [installedIds]);

  const handleScopeChange = useCallback((skillId: string, scope: SkillScope) => {
    const next = { ...scopes, [skillId]: scope };
    setScopes(next);
    setSkillScopes(next);
  }, [scopes]);

  const cardBg = isMonet
    ? 'bg-white/15 border-white/20 hover:bg-white/25'
    : isNotion
      ? 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500'
      : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-dark-border hover:border-forsion-300 dark:hover:border-forsion-700';

  const filterBtnClass = (active: boolean) =>
    active
      ? isMonet
        ? 'bg-white/25 text-white border-white/30'
        : 'bg-forsion-100 text-forsion-700 border-forsion-300 dark:bg-forsion-900/30 dark:text-forsion-400 dark:border-forsion-700'
      : isMonet
        ? 'bg-white/10 text-white/70 border-white/15 hover:bg-white/15'
        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-zinc-800 dark:text-gray-400 dark:border-zinc-700 dark:hover:bg-zinc-700';

  return (
    <div className="space-y-5">
      <div>
        <h3 className={`text-lg font-medium mb-1 ${isMonet ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          Skills Market
        </h3>
        <p className={`text-sm ${isMonet ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
          Browse, install, and manage Skills to extend your AI&apos;s capabilities.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isMonet ? 'text-white/40' : 'text-gray-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-forsion-500/30 ${
              isMonet
                ? 'bg-white/15 border-white/20 text-white placeholder-white/40'
                : 'bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-dark-border text-gray-900 dark:text-white'
            }`}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'official', 'installed'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${filterBtnClass(filter === f)}`}
            >
              {f === 'all' ? 'All' : f === 'official' ? 'Official' : 'Installed'}
            </button>
          ))}
        </div>
      </div>

      {/* Skill Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredSkills.map(skill => {
          const IconComp = SKILL_ICONS[skill.icon] || Puzzle;
          const isInstalled = installedIds.includes(skill.id);

          return (
            <div
              key={skill.id}
              className={`rounded-xl border p-4 transition-all ${cardBg}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isMonet
                    ? 'bg-white/20'
                    : 'bg-forsion-50 dark:bg-forsion-900/20'
                }`}>
                  <IconComp size={20} className={isMonet ? 'text-white' : 'text-forsion-600 dark:text-forsion-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold text-sm truncate ${isMonet ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                      {skill.name}
                    </span>
                    {skill.isBuiltin && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                        isMonet ? 'bg-white/20 text-white/80' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300'
                      }`}>
                        Official
                      </span>
                    )}
                  </div>
                  <p className={`text-xs leading-relaxed line-clamp-2 ${isMonet ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
                    {skill.description}
                  </p>
                  {skill.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {skill.tools.slice(0, 3).map(t => (
                        <span key={t.name} className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isMonet ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                        }`}>
                          {t.name}
                        </span>
                      ))}
                      {skill.tools.length > 3 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isMonet ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'
                        }`}>
                          +{skill.tools.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                {isInstalled && !skill.isWorkspace && (
                  <select
                    value={scopes[skill.id] || 'global'}
                    onChange={e => handleScopeChange(skill.id, e.target.value as SkillScope)}
                    className={`text-[11px] px-2 py-1 rounded-lg border focus:outline-none ${
                      isMonet
                        ? 'bg-white/15 border-white/20 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300'
                    }`}
                  >
                    <option value="global">Global</option>
                    <option value="session">Session Only</option>
                    <option value="disabled">Disabled</option>
                  </select>
                )}
                <div className="ml-auto">
                  {isInstalled ? (
                    <button
                      onClick={() => handleUninstall(skill.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isMonet
                          ? 'bg-white/20 text-white hover:bg-white/30'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
                      }`}
                    >
                      <Check size={14} />
                      Installed
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstall(skill.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isMonet
                          ? 'bg-white/25 text-white hover:bg-white/35'
                          : 'bg-forsion-600 text-white hover:bg-forsion-500'
                      }`}
                    >
                      <Download size={14} />
                      Install
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Create Custom Skill Card */}
        {onOpenSkillEditor && (
          <button
            onClick={onOpenSkillEditor}
            className={`rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center gap-2 min-h-[140px] transition-colors ${
              isMonet
                ? 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'
                : 'border-gray-200 text-gray-400 hover:border-forsion-300 hover:text-forsion-500 dark:border-zinc-700 dark:text-gray-500 dark:hover:border-forsion-700 dark:hover:text-forsion-400'
            }`}
          >
            <Plus size={24} />
            <span className="text-sm font-medium">Create Custom Skill</span>
          </button>
        )}
      </div>

      {filteredSkills.length === 0 && (
        <div className={`text-center py-12 ${isMonet ? 'text-white/40' : 'text-gray-400 dark:text-gray-500'}`}>
          <Puzzle size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No skills found matching your search.</p>
        </div>
      )}
    </div>
  );
};

export default SkillsMarket;
export { getInstalledSkillIds, setInstalledSkillIds, getSkillScopes, setSkillScopes };
