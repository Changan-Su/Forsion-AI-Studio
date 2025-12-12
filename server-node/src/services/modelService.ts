import { query } from '../config/database.js';
import type { GlobalModel } from '../types/index.js';

export async function listGlobalModels(
  includeDisabled: boolean = false,
  includeApiKeys: boolean = false
): Promise<GlobalModel[]> {
  let sql = 'SELECT * FROM global_models';
  if (!includeDisabled) {
    sql += ' WHERE is_enabled = TRUE';
  }
  sql += ' ORDER BY created_at DESC';

  const rows = await query<any[]>(sql);
  
  return rows.map(row => {
    const model: GlobalModel = {
      id: row.id,
      name: row.name,
      provider: row.provider,
      description: row.description,
      icon: row.icon || 'Box',
      apiModelId: row.api_model_id,
      configKey: row.config_key,
      defaultBaseUrl: row.default_base_url,
      isEnabled: !!row.is_enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    
    if (includeApiKeys) {
      model.apiKey = row.api_key;
    }
    
    return model;
  });
}

export async function getGlobalModel(modelId: string): Promise<GlobalModel | null> {
  const rows = await query<any[]>(
    'SELECT * FROM global_models WHERE id = ?',
    [modelId]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    description: row.description,
    icon: row.icon || 'Box',
    apiModelId: row.api_model_id,
    configKey: row.config_key,
    defaultBaseUrl: row.default_base_url,
    apiKey: row.api_key,
    isEnabled: !!row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createGlobalModel(model: Partial<GlobalModel>): Promise<GlobalModel> {
  if (!model.id || !model.name || !model.provider) {
    throw new Error('Model id, name, and provider are required');
  }

  await query(
    `INSERT INTO global_models (id, name, provider, description, icon, api_model_id, config_key, default_base_url, api_key, is_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      model.id,
      model.name,
      model.provider,
      model.description || null,
      model.icon || 'Box',
      model.apiModelId || null,
      model.configKey || model.id,
      model.defaultBaseUrl || null,
      model.apiKey || null,
      model.isEnabled !== false ? 1 : 0,
    ]
  );

  return (await getGlobalModel(model.id))!;
}

export async function updateGlobalModel(
  modelId: string,
  updates: Partial<GlobalModel>
): Promise<GlobalModel | null> {
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.provider !== undefined) {
    setClauses.push('provider = ?');
    values.push(updates.provider);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description);
  }
  if (updates.icon !== undefined) {
    setClauses.push('icon = ?');
    values.push(updates.icon);
  }
  if (updates.apiModelId !== undefined) {
    setClauses.push('api_model_id = ?');
    values.push(updates.apiModelId);
  }
  if (updates.configKey !== undefined) {
    setClauses.push('config_key = ?');
    values.push(updates.configKey);
  }
  if (updates.defaultBaseUrl !== undefined) {
    setClauses.push('default_base_url = ?');
    values.push(updates.defaultBaseUrl);
  }
  if (updates.apiKey !== undefined) {
    setClauses.push('api_key = ?');
    values.push(updates.apiKey);
  }
  if (updates.isEnabled !== undefined) {
    setClauses.push('is_enabled = ?');
    values.push(updates.isEnabled ? 1 : 0);
  }

  if (setClauses.length === 0) {
    return getGlobalModel(modelId);
  }

  values.push(modelId);
  await query(
    `UPDATE global_models SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );

  return getGlobalModel(modelId);
}

export async function deleteGlobalModel(modelId: string): Promise<boolean> {
  const result = await query<any>(
    'DELETE FROM global_models WHERE id = ?',
    [modelId]
  );
  return result.affectedRows > 0;
}

export async function ensureBuiltinModels(): Promise<void> {
  const builtinModels: Partial<GlobalModel>[] = [
    // Google Models
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini Flash',
      provider: 'gemini',
      description: 'Fast and versatile model for everyday tasks.',
      icon: 'Zap',
      configKey: 'google',
    },
    {
      id: 'gemini-3-pro-preview',
      name: 'Gemini Pro',
      provider: 'gemini',
      description: 'Advanced reasoning and complex tasks.',
      icon: 'Brain',
      configKey: 'google',
    },
    {
      id: 'gemini-2.5-flash-image',
      name: 'Nano Banana (Image)',
      provider: 'gemini',
      description: 'Generate and edit images.',
      icon: 'Image',
      configKey: 'google',
    },
    // OpenAI Models
    {
      id: 'gpt-5',
      name: 'GPT 5 (Preview)',
      provider: 'external',
      description: 'Next-gen reasoning model.',
      icon: 'Sparkles',
      apiModelId: 'gpt-5',
      defaultBaseUrl: 'https://api.openai.com/v1',
      configKey: 'openai',
    },
    {
      id: 'chatgpt-4o',
      name: 'GPT-4o',
      provider: 'external',
      description: 'High-intelligence flagship model.',
      icon: 'MessageSquare',
      apiModelId: 'gpt-4o',
      defaultBaseUrl: 'https://api.openai.com/v1',
      configKey: 'openai',
    },
    {
      id: 'chatgpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'external',
      description: 'Cost-efficient small model.',
      icon: 'Zap',
      apiModelId: 'gpt-4o-mini',
      defaultBaseUrl: 'https://api.openai.com/v1',
      configKey: 'openai',
    },
    // DeepSeek Models
    {
      id: 'deepseek-chat',
      name: 'DeepSeek V3',
      provider: 'external',
      description: 'DeepSeek chat model.',
      icon: 'Code',
      apiModelId: 'deepseek-chat',
      defaultBaseUrl: 'https://api.deepseek.com',
      configKey: 'deepseek',
    },
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek R1',
      provider: 'external',
      description: 'Advanced reasoning model (CoT).',
      icon: 'BrainCircuit',
      apiModelId: 'deepseek-reasoner',
      defaultBaseUrl: 'https://api.deepseek.com',
      configKey: 'deepseek',
    },
  ];

  for (const modelData of builtinModels) {
    const existing = await getGlobalModel(modelData.id);
    if (!existing) {
      await createGlobalModel({
        ...modelData,
        isEnabled: true,
      });
      console.log(`✅ Created builtin model: ${modelData.name}`);
    }
  }
}

