import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import type { CreditPricing } from '../types/index.js';

const DEFAULT_PRICING: CreditPricing = {
  id: 'default',
  modelId: 'default',
  tokensPerCredit: 100.0,
  inputMultiplier: 1.0,
  outputMultiplier: 1.0,
  isActive: true,
};

export async function getPricingForModel(modelId: string): Promise<CreditPricing> {
  const rows = await query<any[]>(
    `SELECT * FROM credit_pricing WHERE model_id = ? AND is_active = TRUE`,
    [modelId]
  );

  if (rows.length > 0) {
    const row = rows[0];
    return {
      id: row.id,
      modelId: row.model_id,
      provider: row.provider,
      tokensPerCredit: parseFloat(row.tokens_per_credit),
      inputMultiplier: parseFloat(row.input_multiplier),
      outputMultiplier: parseFloat(row.output_multiplier),
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  return DEFAULT_PRICING;
}

export async function setPricingForModel(
  modelId: string,
  tokensPerCredit: number,
  inputMultiplier: number = 1.0,
  outputMultiplier: number = 1.0,
  provider?: string
): Promise<CreditPricing> {
  // Check if pricing exists
  const existing = await query<any[]>(
    `SELECT id FROM credit_pricing WHERE model_id = ?`,
    [modelId]
  );

  if (existing.length > 0) {
    // Update existing
    await query(
      `UPDATE credit_pricing 
       SET tokens_per_credit = ?, input_multiplier = ?, output_multiplier = ?, 
           provider = ?, updated_at = NOW()
       WHERE model_id = ?`,
      [tokensPerCredit, inputMultiplier, outputMultiplier, provider || null, modelId]
    );

    const updated = await query<any[]>(
      `SELECT * FROM credit_pricing WHERE model_id = ?`,
      [modelId]
    );

    const row = updated[0];
    return {
      id: row.id,
      modelId: row.model_id,
      provider: row.provider,
      tokensPerCredit: parseFloat(row.tokens_per_credit),
      inputMultiplier: parseFloat(row.input_multiplier),
      outputMultiplier: parseFloat(row.output_multiplier),
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } else {
    // Create new
    const id = uuidv4();
    await query(
      `INSERT INTO credit_pricing 
       (id, model_id, provider, tokens_per_credit, input_multiplier, output_multiplier, is_active)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [id, modelId, provider || null, tokensPerCredit, inputMultiplier, outputMultiplier]
    );

    const created = await query<any[]>(
      `SELECT * FROM credit_pricing WHERE id = ?`,
      [id]
    );

    const row = created[0];
    return {
      id: row.id,
      modelId: row.model_id,
      provider: row.provider,
      tokensPerCredit: parseFloat(row.tokens_per_credit),
      inputMultiplier: parseFloat(row.input_multiplier),
      outputMultiplier: parseFloat(row.output_multiplier),
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export async function listAllPricing(): Promise<CreditPricing[]> {
  const rows = await query<any[]>(
    `SELECT * FROM credit_pricing ORDER BY model_id`
  );

  return rows.map(row => ({
    id: row.id,
    modelId: row.model_id,
    provider: row.provider,
    tokensPerCredit: parseFloat(row.tokens_per_credit),
    inputMultiplier: parseFloat(row.input_multiplier),
    outputMultiplier: parseFloat(row.output_multiplier),
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getDefaultPricing(): Promise<CreditPricing> {
  return DEFAULT_PRICING;
}

export async function calculateCost(
  modelId: string,
  tokensInput: number,
  tokensOutput: number
): Promise<number> {
  const pricing = await getPricingForModel(modelId);
  const effectiveInputTokens = tokensInput * pricing.inputMultiplier;
  const effectiveOutputTokens = tokensOutput * pricing.outputMultiplier;
  const totalTokens = effectiveInputTokens + effectiveOutputTokens;
  const cost = totalTokens / pricing.tokensPerCredit;
  return Math.ceil(cost * 100) / 100; // Round to 2 decimal places
}



