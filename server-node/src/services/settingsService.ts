import { query } from '../config/database.js';

const DEFAULT_MODEL_KEY = 'default_model_id';

export async function getDefaultModelId(): Promise<string | null> {
  const rows = await query<any[]>(
    `SELECT value FROM global_settings WHERE \`key\` = ? LIMIT 1`,
    [DEFAULT_MODEL_KEY]
  );
  if (rows.length === 0) return null;
  return rows[0].value || null;
}

export async function setDefaultModelId(modelId: string | null): Promise<void> {
  if (!modelId) {
    await query(
      `DELETE FROM global_settings WHERE \`key\` = ?`,
      [DEFAULT_MODEL_KEY]
    );
    return;
  }

  // Upsert the value
  await query(
    `INSERT INTO global_settings (\`key\`, value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [DEFAULT_MODEL_KEY, modelId]
  );
}





