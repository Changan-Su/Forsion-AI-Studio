import { Router } from 'express';
import { 
  listGlobalModels, 
  getGlobalModel, 
  createGlobalModel, 
  updateGlobalModel, 
  deleteGlobalModel 
} from '../services/modelService.js';
import { getDefaultModelId, setDefaultModelId } from '../services/settingsService.js';
import { authMiddleware, adminMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Public: List enabled models (no API keys)
router.get('/models', optionalAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const models = await listGlobalModels(false, false);
    res.json(models);
  } catch (error: any) {
    console.error('List models error:', error);
    res.status(500).json({ detail: 'Failed to list models' });
  }
});

// ============ Admin Routes ============

// List all models with API keys (admin only)
router.get('/admin/models', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const models = await listGlobalModels(true, true);
    res.json(models);
  } catch (error: any) {
    console.error('List models error:', error);
    res.status(500).json({ detail: 'Failed to list models' });
  }
});

// Get single model with API key (admin only)
router.get('/admin/models/:modelId', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const model = await getGlobalModel(req.params.modelId);
    if (!model) {
      return res.status(404).json({ detail: 'Model not found' });
    }
    res.json(model);
  } catch (error: any) {
    console.error('Get model error:', error);
    res.status(500).json({ detail: 'Failed to get model' });
  }
});

// Create model (admin only)
router.post('/admin/models', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const model = await createGlobalModel(req.body);
    res.status(201).json(model);
  } catch (error: any) {
    console.error('Create model error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ detail: 'Model ID already exists' });
    }
    res.status(500).json({ detail: 'Failed to create model' });
  }
});

// Update model (admin only)
router.put('/admin/models/:modelId', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const model = await updateGlobalModel(req.params.modelId, req.body);
    if (!model) {
      return res.status(404).json({ detail: 'Model not found' });
    }
    res.json(model);
  } catch (error: any) {
    console.error('Update model error:', error);
    res.status(500).json({ detail: 'Failed to update model' });
  }
});

// Delete model (admin only)
router.delete('/admin/models/:modelId', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const success = await deleteGlobalModel(req.params.modelId);
    if (!success) {
      return res.status(404).json({ detail: 'Model not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete model error:', error);
    res.status(500).json({ detail: 'Failed to delete model' });
  }
});

// Get default model (admin only)
router.get('/admin/default-model', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const modelId = await getDefaultModelId();
    res.json({ defaultModelId: modelId });
  } catch (error: any) {
    console.error('Get default model error:', error);
    res.status(500).json({ detail: 'Failed to get default model' });
  }
});

// Set default model (admin only)
router.put('/admin/default-model', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { modelId } = req.body;
    if (!modelId) {
      return res.status(400).json({ detail: 'modelId is required' });
    }

    const model = await getGlobalModel(modelId);
    if (!model) {
      return res.status(404).json({ detail: 'Model not found' });
    }
    if (!model.isEnabled) {
      return res.status(400).json({ detail: 'Model is disabled' });
    }

    await setDefaultModelId(modelId);
    res.json({ success: true, defaultModelId: modelId });
  } catch (error: any) {
    console.error('Set default model error:', error);
    res.status(500).json({ detail: 'Failed to set default model' });
  }
});

export default router;

