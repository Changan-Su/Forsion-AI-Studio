import { Router } from 'express';
import {
  listAllPricing,
  setPricingForModel,
  getPricingForModel,
} from '../services/creditPricingService.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// List all pricing configurations (admin only)
router.get('/admin/credit-pricing', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const pricing = await listAllPricing();
    res.json(pricing);
  } catch (error: any) {
    console.error('List pricing error:', error);
    res.status(500).json({ detail: 'Failed to list pricing configurations' });
  }
});

// Set pricing for a model (admin only)
router.post('/admin/credit-pricing', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { model_id, tokens_per_credit, input_multiplier, output_multiplier, provider } = req.body;

    if (!model_id) {
      return res.status(400).json({ detail: 'model_id is required' });
    }

    if (!tokens_per_credit || tokens_per_credit <= 0) {
      return res.status(400).json({ detail: 'tokens_per_credit must be greater than 0' });
    }

    const pricing = await setPricingForModel(
      model_id,
      tokens_per_credit,
      input_multiplier || 1.0,
      output_multiplier || 1.0,
      provider
    );

    res.status(201).json(pricing);
  } catch (error: any) {
    console.error('Set pricing error:', error);
    res.status(500).json({ detail: 'Failed to set pricing' });
  }
});

// Update pricing configuration (admin only)
router.put('/admin/credit-pricing/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { tokens_per_credit, input_multiplier, output_multiplier, provider, is_active } = req.body;

    // Get existing pricing to get model_id
    const allPricing = await listAllPricing();
    const existing = allPricing.find(p => p.id === req.params.id);

    if (!existing) {
      return res.status(404).json({ detail: 'Pricing configuration not found' });
    }

    const pricing = await setPricingForModel(
      existing.modelId,
      tokens_per_credit !== undefined ? tokens_per_credit : existing.tokensPerCredit,
      input_multiplier !== undefined ? input_multiplier : existing.inputMultiplier,
      output_multiplier !== undefined ? output_multiplier : existing.outputMultiplier,
      provider !== undefined ? provider : existing.provider
    );

    // Update is_active if provided
    if (is_active !== undefined) {
      const { query } = await import('../config/database.js');
      await query(
        `UPDATE credit_pricing SET is_active = ? WHERE id = ?`,
        [is_active ? 1 : 0, req.params.id]
      );
      pricing.isActive = is_active;
    }

    res.json(pricing);
  } catch (error: any) {
    console.error('Update pricing error:', error);
    res.status(500).json({ detail: 'Failed to update pricing' });
  }
});

// Get pricing for a specific model (admin only)
router.get('/admin/credit-pricing/:modelId', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const pricing = await getPricingForModel(req.params.modelId);
    res.json(pricing);
  } catch (error: any) {
    console.error('Get pricing error:', error);
    res.status(500).json({ detail: 'Failed to get pricing' });
  }
});

export default router;






