import { query } from '../config/database.js';
import type { ApiUsageLog } from '../types/index.js';

export async function logApiUsage(
  username: string,
  modelId: string,
  modelName?: string,
  provider?: string,
  tokensInput: number = 0,
  tokensOutput: number = 0,
  success: boolean = true,
  errorMessage?: string
): Promise<void> {
  await query(
    `INSERT INTO api_usage_logs (username, model_id, model_name, provider, tokens_input, tokens_output, success, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, modelId, modelName ?? null, provider ?? null, tokensInput, tokensOutput, success ? 1 : 0, errorMessage ?? null]
  );
}

export async function getUsageStats(
  days: number = 7,
  username?: string
): Promise<{
  // camelCase (new format)
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  successRate: number;
  successful: number;
  failed: number;
  byModel: Array<{ modelId: string; modelName: string; count: number }>;
  byDay: Array<{ date: string; count: number; tokens: number }>;
  byUser: Array<{ username: string; count: number }>;
  recentLogs: ApiUsageLog[];
  // snake_case (for backward compatibility with admin panel)
  total_requests: number;
  total_tokens_input: number;
  total_tokens_output: number;
  success_rate: number;
  by_model: Array<{ model_id: string; model_name: string; count: number }>;
  by_day: Array<{ date: string; count: number; tokens: number }>;
  by_user: Array<{ username: string; count: number }>;
  recent_logs: Array<{
    id: number;
    username: string;
    model_id: string;
    model_name: string | undefined;
    provider: string | undefined;
    tokens_input: number;
    tokens_output: number;
    success: boolean;
    error_message: string | undefined;
    created_at: Date | undefined;
  }>;
}> {
  let whereClause = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';
  const params: any[] = [days];

  if (username) {
    whereClause += ' AND username = ?';
    params.push(username);
  }

  // Total stats
  const totalRows = await query<any[]>(
    `SELECT 
      COUNT(*) as total_requests,
      SUM(tokens_input) as total_tokens_input,
      SUM(tokens_output) as total_tokens_output,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_count
     FROM api_usage_logs ${whereClause}`,
    params
  );

  const total = totalRows[0] || {};
  const totalRequests = Number(total.total_requests) || 0;
  const totalTokensInput = Number(total.total_tokens_input) || 0;
  const totalTokensOutput = Number(total.total_tokens_output) || 0;
  const successCount = Number(total.success_count) || 0;
  const failedCount = Number(total.failed_count) || 0;
  const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 100;

  // By model
  const byModelRows = await query<any[]>(
    `SELECT model_id, model_name, COUNT(*) as count
     FROM api_usage_logs ${whereClause}
     GROUP BY model_id, model_name
     ORDER BY count DESC
     LIMIT 10`,
    params
  );

  // By day
  const byDayRows = await query<any[]>(
    `SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      SUM(tokens_input + tokens_output) as tokens
     FROM api_usage_logs ${whereClause}
     GROUP BY DATE(created_at)
     ORDER BY date DESC`,
    params
  );

  // By user
  const byUserRows = await query<any[]>(
    `SELECT username, COUNT(*) as count
     FROM api_usage_logs ${whereClause}
     GROUP BY username
     ORDER BY count DESC
     LIMIT 10`,
    params
  );

  // Recent logs
  const recentLogs = await getRecentLogs(20, username);

  // Build camelCase format
  const byModel = byModelRows.map(row => ({
    modelId: row.model_id,
    modelName: row.model_name || row.model_id,
    count: Number(row.count),
  }));

  const byDay = byDayRows.map(row => ({
    date: row.date,
    count: Number(row.count),
    tokens: Number(row.tokens) || 0,
  }));

  const byUser = byUserRows.map(row => ({
    username: row.username,
    count: Number(row.count),
  }));

  // Build snake_case format for admin panel compatibility
  const by_model = byModelRows.map(row => ({
    model_id: row.model_id,
    model_name: row.model_name || row.model_id,
    count: Number(row.count),
  }));

  const by_day = byDayRows.map(row => ({
    date: row.date,
    count: Number(row.count),
    tokens: Number(row.tokens) || 0,
  }));

  const by_user = byUserRows.map(row => ({
    username: row.username,
    count: Number(row.count),
  }));

  // Convert recent logs to snake_case for admin panel
  const recent_logs = recentLogs.map(log => ({
    id: log.id,
    username: log.username,
    model_id: log.modelId,
    model_name: log.modelName,
    provider: log.provider,
    tokens_input: log.tokensInput,
    tokens_output: log.tokensOutput,
    success: log.success,
    error_message: log.errorMessage,
    created_at: log.createdAt,
  }));

  return {
    // camelCase
    totalRequests,
    totalTokensInput,
    totalTokensOutput,
    successRate,
    successful: successCount,
    failed: failedCount,
    byModel,
    byDay,
    byUser,
    recentLogs,
    // snake_case (backward compatibility)
    total_requests: totalRequests,
    total_tokens_input: totalTokensInput,
    total_tokens_output: totalTokensOutput,
    success_rate: successRate,
    by_model,
    by_day,
    by_user,
    recent_logs,
  };
}

export async function getRecentLogs(limit: number = 50, username?: string): Promise<ApiUsageLog[]> {
  let sql = 'SELECT * FROM api_usage_logs';
  const params: any[] = [];

  if (username) {
    sql += ' WHERE username = ?';
    params.push(username);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = await query<any[]>(sql, params);

  return rows.map(row => ({
    id: row.id,
    username: row.username,
    modelId: row.model_id,
    modelName: row.model_name,
    provider: row.provider,
    tokensInput: row.tokens_input,
    tokensOutput: row.tokens_output,
    success: !!row.success,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

