import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Code2, Globe, Wrench } from 'lucide-react';
import {
  CustomSkillDefinition,
  CustomToolDefinition,
  CustomToolExecutorConfig,
  ToolParameterSchema,
} from '../types';

interface SkillEditorProps {
  /** Pass an existing skill to edit, or undefined to create a new one */
  skill?: CustomSkillDefinition;
  onSave: (skill: CustomSkillDefinition) => void;
  onClose: () => void;
  themePreset: 'default' | 'notion' | 'monet' | 'apple' | 'forsion1';
}

// ── Defaults ──────────────────────────────────────────────────────────────────

function makeId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function emptyTool(skillId: string): CustomToolDefinition {
  return {
    name: '',
    description: '',
    parameters: { type: 'object', properties: {}, required: [] },
    skillId,
    isBuiltin: false,
    executor: { type: 'javascript', code: '// args 对象包含所有参数\n// 返回值将作为工具结果\nreturn "hello";' },
  };
}

function emptySkill(): CustomSkillDefinition {
  const id = makeId();
  return {
    id,
    name: '',
    description: '',
    icon: 'Wrench',
    tools: [emptyTool(id)],
    isBuiltin: false as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Parameter editor ──────────────────────────────────────────────────────────

interface ParamEntry {
  key: string;
  type: string;
  description: string;
  required: boolean;
}

function schemaToParams(schema: ToolParameterSchema): ParamEntry[] {
  const props = schema.properties ?? {};
  const req = schema.required ?? [];
  return Object.entries(props).map(([key, val]) => ({
    key,
    type: (val as ToolParameterSchema).type ?? 'string',
    description: (val as ToolParameterSchema).description ?? '',
    required: req.includes(key),
  }));
}

function paramsToSchema(params: ParamEntry[]): ToolParameterSchema {
  const properties: Record<string, ToolParameterSchema> = {};
  const required: string[] = [];
  for (const p of params) {
    if (!p.key.trim()) continue;
    properties[p.key.trim()] = {
      type: (p.type || 'string') as ToolParameterSchema['type'],
      description: p.description,
    };
    if (p.required) required.push(p.key.trim());
  }
  return { type: 'object', properties, required };
}

// ── Component ─────────────────────────────────────────────────────────────────

const SkillEditor: React.FC<SkillEditorProps> = ({ skill, onSave, onClose, themePreset }) => {
  const [draft, setDraft] = useState<CustomSkillDefinition>(skill ? { ...skill, tools: skill.tools.map(t => ({ ...t })) } : emptySkill());
  const [activeTool, setActiveTool] = useState(0);
  // Parameter state per tool
  const [toolParams, setToolParams] = useState<ParamEntry[][]>(
    draft.tools.map(t => schemaToParams(t.parameters))
  );

  const isNotion = themePreset === 'notion';
  const isMonet = themePreset === 'monet';

  const inputClass = isNotion
    ? 'w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400'
    : isMonet
      ? 'w-full border border-rose-200/50 dark:border-rose-800/30 rounded-lg px-3 py-1.5 text-sm bg-white/50 dark:bg-gray-900/50 focus:outline-none focus:ring-1 focus:ring-rose-400'
      : 'w-full border border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-gray-900 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-gray-100';

  const labelClass = 'text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1';
  const divider = 'border-t border-gray-200 dark:border-gray-700 my-3';

  const updateTool = (idx: number, patch: Partial<CustomToolDefinition>) => {
    setDraft(prev => ({
      ...prev,
      tools: prev.tools.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  };

  const updateExecutor = (idx: number, patch: Partial<CustomToolExecutorConfig>) => {
    setDraft(prev => ({
      ...prev,
      tools: prev.tools.map((t, i) =>
        i === idx ? { ...t, executor: { ...t.executor, ...patch } as CustomToolExecutorConfig } : t
      ),
    }));
  };

  const addTool = () => {
    const newTool = emptyTool(draft.id);
    setDraft(prev => ({ ...prev, tools: [...prev.tools, newTool] }));
    setToolParams(prev => [...prev, []]);
    setActiveTool(draft.tools.length);
  };

  const removeTool = (idx: number) => {
    if (draft.tools.length <= 1) return;
    setDraft(prev => ({ ...prev, tools: prev.tools.filter((_, i) => i !== idx) }));
    setToolParams(prev => prev.filter((_, i) => i !== idx));
    if (activeTool >= draft.tools.length - 1) setActiveTool(Math.max(0, draft.tools.length - 2));
  };

  const updateParam = (toolIdx: number, paramIdx: number, patch: Partial<ParamEntry>) => {
    setToolParams(prev => prev.map((params, ti) =>
      ti === toolIdx ? params.map((p, pi) => (pi === paramIdx ? { ...p, ...patch } : p)) : params
    ));
  };

  const addParam = (toolIdx: number) => {
    setToolParams(prev => prev.map((params, ti) =>
      ti === toolIdx ? [...params, { key: '', type: 'string', description: '', required: false }] : params
    ));
  };

  const removeParam = (toolIdx: number, paramIdx: number) => {
    setToolParams(prev => prev.map((params, ti) =>
      ti === toolIdx ? params.filter((_, pi) => pi !== paramIdx) : params
    ));
  };

  const handleSave = () => {
    // Validate
    if (!draft.name.trim()) return;
    if (draft.tools.some(t => !t.name.trim())) return;

    // Merge params into tool schemas
    const finalSkill: CustomSkillDefinition = {
      ...draft,
      name: draft.name.trim(),
      updatedAt: Date.now(),
      tools: draft.tools.map((t, i) => ({
        ...t,
        name: t.name.trim().replace(/\s+/g, '_').toLowerCase(),
        skillId: draft.id,
        parameters: paramsToSchema(toolParams[i] ?? []),
      })),
    };
    onSave(finalSkill);
  };

  const currentTool = draft.tools[activeTool];
  const currentParams = toolParams[activeTool] ?? [];

  const accentBg = isNotion ? 'bg-gray-800 text-white' : isMonet ? 'bg-rose-500 text-white' : 'bg-cyan-500 text-gray-900';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className={`w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl shadow-2xl ${isNotion ? 'bg-white dark:bg-gray-900' : isMonet ? 'bg-rose-50 dark:bg-gray-900' : 'bg-gray-900 border border-gray-700'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Wrench size={18} className={isNotion ? 'text-gray-700' : isMonet ? 'text-rose-500' : 'text-cyan-400'} />
            <h2 className="font-semibold text-sm">{skill ? 'Edit Skill' : 'Create Skill'}</h2>
          </div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* Skill name + description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>Skill Name</p>
              <input value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="e.g. My API Tools" className={inputClass} />
            </div>
            <div>
              <p className={labelClass}>Description</p>
              <input value={draft.description} onChange={e => setDraft(p => ({ ...p, description: e.target.value }))} placeholder="What does this skill do?" className={inputClass} />
            </div>
          </div>

          <div className={divider} />

          {/* Tool tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {draft.tools.map((t, i) => (
              <button
                key={i}
                onClick={() => setActiveTool(i)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  i === activeTool
                    ? accentBg
                    : 'opacity-60 hover:opacity-100 border border-gray-300 dark:border-gray-600'
                }`}
              >
                {t.name || `Tool ${i + 1}`}
              </button>
            ))}
            <button onClick={addTool} className="px-2 py-1 text-xs opacity-40 hover:opacity-100 border border-dashed border-gray-400 rounded-md">
              <Plus size={12} />
            </button>
          </div>

          {/* Active tool editor */}
          {currentTool && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelClass}>Tool Name (snake_case)</p>
                  <input
                    value={currentTool.name}
                    onChange={e => updateTool(activeTool, { name: e.target.value })}
                    placeholder="e.g. fetch_data"
                    className={inputClass}
                  />
                </div>
                <div>
                  <p className={labelClass}>Tool Description</p>
                  <input
                    value={currentTool.description}
                    onChange={e => updateTool(activeTool, { description: e.target.value })}
                    placeholder="Describe what this tool does for the model"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Executor type toggle */}
              <div>
                <p className={labelClass}>Executor Type</p>
                <div className="flex gap-2">
                  {(['javascript', 'http'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => updateExecutor(activeTool, {
                        type,
                        ...(type === 'http' ? { url: '', method: 'GET' as const } : { code: '// args 对象包含所有参数\nreturn "result";' }),
                      } as CustomToolExecutorConfig)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-all ${
                        currentTool.executor.type === type
                          ? accentBg + ' border-transparent'
                          : 'border-gray-300 dark:border-gray-600 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {type === 'javascript' ? <Code2 size={13} /> : <Globe size={13} />}
                      {type === 'javascript' ? 'JavaScript' : 'HTTP API'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Executor config */}
              {currentTool.executor.type === 'http' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <div>
                      <p className={labelClass}>Method</p>
                      <select
                        value={(currentTool.executor as any).method ?? 'GET'}
                        onChange={e => updateExecutor(activeTool, { method: e.target.value as any })}
                        className={inputClass}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>
                    <div>
                      <p className={labelClass}>URL (use {'{{param}}'} for placeholders)</p>
                      <input
                        value={(currentTool.executor as any).url ?? ''}
                        onChange={e => updateExecutor(activeTool, { url: e.target.value })}
                        placeholder="https://api.example.com/search?q={{query}}"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {((currentTool.executor as any).method !== 'GET') && (
                    <div>
                      <p className={labelClass}>Body Template (JSON, use {'{{param}}'} for placeholders)</p>
                      <textarea
                        value={(currentTool.executor as any).bodyTemplate ?? ''}
                        onChange={e => updateExecutor(activeTool, { bodyTemplate: e.target.value })}
                        placeholder={'{"query": "{{query}}", "limit": 10}'}
                        rows={3}
                        className={`${inputClass} font-mono text-xs resize-none`}
                      />
                    </div>
                  )}
                </div>
              )}

              {currentTool.executor.type === 'javascript' && (
                <div>
                  <p className={labelClass}>JavaScript Code (<code className="text-[10px]">args</code> object available, must return a value)</p>
                  <textarea
                    value={(currentTool.executor as any).code ?? ''}
                    onChange={e => updateExecutor(activeTool, { code: e.target.value })}
                    rows={6}
                    className={`${inputClass} font-mono text-xs resize-none`}
                    placeholder="// Access parameters via args.paramName&#10;const result = args.query.toUpperCase();&#10;return result;"
                  />
                </div>
              )}

              <div className={divider} />

              {/* Parameters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className={labelClass}>Parameters</p>
                  <button onClick={() => addParam(activeTool)} className="flex items-center gap-1 text-[10px] opacity-50 hover:opacity-100">
                    <Plus size={10} /> Add
                  </button>
                </div>
                {currentParams.length === 0 && (
                  <p className="text-xs opacity-40">No parameters. Click "Add" to define inputs for this tool.</p>
                )}
                <div className="space-y-1.5">
                  {currentParams.map((param, pi) => (
                    <div key={pi} className="flex items-center gap-2">
                      <input
                        value={param.key}
                        onChange={e => updateParam(activeTool, pi, { key: e.target.value })}
                        placeholder="name"
                        className={`${inputClass} w-24 flex-shrink-0`}
                      />
                      <select
                        value={param.type}
                        onChange={e => updateParam(activeTool, pi, { type: e.target.value })}
                        className={`${inputClass} w-20 flex-shrink-0`}
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                      </select>
                      <input
                        value={param.description}
                        onChange={e => updateParam(activeTool, pi, { description: e.target.value })}
                        placeholder="description"
                        className={inputClass}
                      />
                      <label className="flex items-center gap-1 text-[10px] whitespace-nowrap cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={param.required}
                          onChange={e => updateParam(activeTool, pi, { required: e.target.checked })}
                          className="w-3 h-3"
                        />
                        req
                      </label>
                      <button onClick={() => removeParam(activeTool, pi)} className="opacity-30 hover:opacity-100 hover:text-red-400 shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remove tool button */}
              {draft.tools.length > 1 && (
                <button
                  onClick={() => removeTool(activeTool)}
                  className="flex items-center gap-1.5 text-xs text-red-400 opacity-60 hover:opacity-100 mt-2"
                >
                  <Trash2 size={12} /> Remove this tool
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!draft.name.trim() || draft.tools.some(t => !t.name.trim())}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-30 ${accentBg}`}
          >
            <Save size={14} /> {skill ? 'Update Skill' : 'Create Skill'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkillEditor;
