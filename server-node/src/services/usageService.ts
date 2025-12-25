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
  errorMessage?: string,
  projectSource?: string
): Promise<void> {
  try {
    // Explicitly include created_at to ensure it's always set
    // Use projectSource from parameter, default to 'ai-studio' if not provided
    await query(
      `INSERT INTO api_usage_logs (username, model_id, model_name, provider, project_source, tokens_input, tokens_output, success, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [username, modelId, modelName ?? null, provider ?? null, projectSource ?? 'ai-studio', tokensInput, tokensOutput, success ? 1 : 0, errorMessage ?? null]
    );
  } catch (error: any) {
    // Log error but don't fail the main request
    console.error('Failed to log API usage:', error.message);
  }
}

// Fix existing null created_at records
export async function fixNullCreatedAt(): Promise<void> {
  try {
    await query(
      `UPDATE api_usage_logs SET created_at = NOW() WHERE created_at IS NULL`
    );
  } catch (error: any) {
    console.error('Failed to fix null created_at:', error.message);
  }
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
  // Include records where created_at is null OR within the date range
  let whereClause = 'WHERE (created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) OR created_at IS NULL)';
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
    `SELECT 
      model_id, 
      model_name, 
      COUNT(*) as count,
      SUM(tokens_input + tokens_output) as tokens
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
    `SELECT 
      username, 
      COUNT(*) as count,
      SUM(tokens_input + tokens_output) as tokens
     FROM api_usage_logs ${whereClause}
     GROUP BY username
     ORDER BY count DESC
     LIMIT 10`,
    params
  );

  // Recent logs - get unique logs only
  const recentLogs = await getRecentLogs(20, username);
  
  // Ensure no duplicates by ID
  const seenIds = new Set();
  const uniqueRecentLogs = recentLogs.filter(log => {
    if (log.id && seenIds.has(log.id)) {
      return false;
    }
    if (log.id) {
      seenIds.add(log.id);
    }
    return true;
  });

  // Build camelCase format
  const byModel = byModelRows.map(row => ({
    modelId: row.model_id,
    modelName: row.model_name || row.model_id,
    count: Number(row.count),
    tokens: Number(row.tokens) || 0,
  }));

  const byDay = byDayRows.map(row => ({
    date: row.date,
    count: Number(row.count),
    tokens: Number(row.tokens) || 0,
  }));

  const byUser = byUserRows.map(row => ({
    username: row.username,
    count: Number(row.count),
    tokens: Number(row.tokens) || 0,
  }));

  // Build snake_case format for admin panel compatibility
  const by_model = byModelRows.map(row => ({
    model_id: row.model_id,
    model_name: row.model_name || row.model_id,
    count: Number(row.count),
    tokens: Number(row.tokens) || 0,
  }));

  const by_day = byDayRows.map(row => ({
    date: row.date,
    count: Number(row.count),
    tokens: Number(row.tokens) || 0,
  }));

  const by_user = byUserRows.map(row => ({
    username: row.username,
    count: Number(row.count),
    tokens: Number(row.tokens) || 0,
  }));

  // Convert recent logs to snake_case for admin panel - use unique logs only
  const recent_logs = uniqueRecentLogs.map(log => ({
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
    recentLogs: uniqueRecentLogs, // Use deduplicated logs
    // snake_case (backward compatibility) - only return recent_logs, not both
    total_requests: totalRequests,
    total_tokens_input: totalTokensInput,
    total_tokens_output: totalTokensOutput,
    success_rate: successRate,
    by_model,
    by_day,
    by_user,
    recent_logs, // Use this in frontend, not recentLogs
  };
}

export async function getRecentLogs(limit: number = 50, username?: string): Promise<ApiUsageLog[]> {
  let sql = 'SELECT * FROM api_usage_logs';
  const params: any[] = [];

  if (username) {
    sql += ' WHERE username = ?';
    params.push(username);
  }

  // Ensure limit is a safe integer and embed directly in SQL (mysql2 LIMIT doesn't work well with prepared stmt params)
  const limitInt = Math.max(1, Math.min(1000, Math.floor(limit)));
  sql += ` ORDER BY created_at DESC LIMIT ${limitInt}`;

  const rows = await query<any[]>(sql, params);

  // Remove duplicates at database level (in case of any data issues)
  const seenRowIds = new Set();
  const uniqueRows = rows.filter(row => {
    if (!row.id) return true; // Include rows without ID
    if (seenRowIds.has(row.id)) return false;
    seenRowIds.add(row.id);
    return true;
  });

  return uniqueRows.map(row => {
    // Ensure created_at is properly formatted as ISO string
    let createdAt = row.created_at;
    
    if (createdAt instanceof Date) {
      createdAt = createdAt.toISOString();
    } else if (typeof createdAt === 'string') {
      // If it's already a string, ensure it's in a parseable format
      // MySQL DATETIME format: "2024-01-01 12:00:00"
      if (createdAt.includes(' ') && !createdAt.includes('T')) {
        createdAt = createdAt.replace(' ', 'T') + 'Z';
      }
    } else if (createdAt) {
      // Try to convert to date if it's a timestamp or other format
      try {
        const date = new Date(createdAt);
        if (!isNaN(date.getTime())) {
          createdAt = date.toISOString();
        }
      } catch (e) {
        console.warn('Could not parse created_at:', createdAt, e);
      }
    }
    
    return {
      id: row.id,
      username: row.username,
      modelId: row.model_id,
      modelName: row.model_name,
      provider: row.provider,
      tokensInput: row.tokens_input,
      tokensOutput: row.tokens_output,
      success: !!row.success,
      errorMessage: row.error_message,
      createdAt: createdAt,
    };
  });
}



