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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:50173',
  'http://localhost:4137',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:50173',
  'http://127.0.0.1:4137',
];

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve admin panel static files
const adminPath = path.join(__dirname, '../../admin');
app.use('/admin', express.static(adminPath));

// Serve admin index.html for admin routes
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
  console.log('🚀 Starting Forsion AI Studio Server (Node.js)...');
  
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

  app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
    console.log(`📊 Admin panel: http://localhost:${PORT}/admin`);
    console.log(`📚 API: http://localhost:${PORT}/api`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

