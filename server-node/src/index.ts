import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { testConnection } from './config/database.js';
import { ensureAdminExists } from './services/userService.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import modelRoutes from './routes/models.js';
import chatRoutes from './routes/chat.js';
import fileRoutes from './routes/files.js';
import usageRoutes from './routes/usage.js';
import inviteCodeRoutes from './routes/inviteCodes.js';
import creditRoutes from './routes/credits.js';
import creditPricingRoutes from './routes/creditPricing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - Support multiple Forsion projects
const allowedOrigins = [
  // AI Studio
  'http://localhost:50173',
  'http://localhost:4137',
  'http://127.0.0.1:50173',
  'http://127.0.0.1:4137',
  // Desktop
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Calendar
  'http://localhost:6006',
  'http://127.0.0.1:6006',
  // Development common ports
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// Support production environment custom domains (via environment variable)
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()));
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', modelRoutes);
app.use('/api', chatRoutes);
app.use('/api', fileRoutes);
app.use('/api', usageRoutes);
app.use('/api', inviteCodeRoutes);
app.use('/api', creditRoutes);
app.use('/api', creditPricingRoutes);

// Health check - Enhanced with database status
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({ 
    status: dbStatus ? 'healthy' : 'unhealthy',
    service: 'forsion-backend-service',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus ? 'connected' : 'disconnected'
  });
});

// Service info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Forsion Backend Service',
    version: '2.0.0',
    description: 'Unified Backend Service for Forsion Projects',
    supportedProjects: ['ai-studio', 'desktop'],
    features: ['auth', 'ai-models', 'chat', 'credits', 'usage-stats', 'file-processing'],
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      models: '/api/models',
      chat: '/api/chat',
      credits: '/api/credits',
      usage: '/api/usage',
      health: '/api/health'
    }
  });
});

// Serve admin panel static files
// Resolve admin path: from dist/ to admin/ (same level as dist/)
// When running from dist/, __dirname is dist/, admin is at the same level
const adminPath = path.resolve(__dirname, '../admin');
console.log('📁 Admin panel path:', adminPath);

// Serve static files from admin directory (CSS, JS, etc.)
app.use('/admin', express.static(adminPath, {
  index: false // Don't serve index.html automatically
}));

// Serve admin index.html for all admin routes (SPA fallback)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(adminPath, 'index.html'));
});

app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(adminPath, 'index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ detail: 'Internal server error' });
});

// Start server
async function startServer() {
  console.log('🚀 Starting Forsion Backend Service (Unified API)...');
  
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Please check your configuration.');
    console.log('💡 Run "npm run db:migrate" to initialize the database tables.');
    process.exit(1);
  }

  // Ensure admin user exists
  try {
    await ensureAdminExists();
  } catch (error) {
    console.error('⚠️ Failed to ensure admin user:', error);
  }

  // Ensure builtin models exist
  try {
    const { ensureBuiltinModels } = await import('./services/modelService.js');
    await ensureBuiltinModels();
  } catch (error) {
    console.error('⚠️ Failed to ensure builtin models:', error);
  }

  // Fix any null created_at in usage logs
  try {
    const { fixNullCreatedAt } = await import('./services/usageService.js');
    await fixNullCreatedAt();
    console.log('✅ Usage logs created_at check complete');
  } catch (error) {
    console.error('⚠️ Failed to fix usage logs:', error);
  }

  app.listen(PORT, () => {
    console.log(`✅ Forsion Backend Service is running on http://localhost:${PORT}`);
    console.log(`📊 Admin panel: http://localhost:${PORT}/admin`);
    console.log(`📚 API: http://localhost:${PORT}/api`);
    console.log(`🔗 Supported projects: AI Studio, Desktop`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

