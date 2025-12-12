import { query, testConnection } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const migrations = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    permissions TEXT,
    max_requests_per_day INT DEFAULT 1000,
    notes TEXT,
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // User settings table
  `CREATE TABLE IF NOT EXISTS user_settings (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) UNIQUE NOT NULL,
    theme VARCHAR(20) DEFAULT 'light',
    theme_preset VARCHAR(50) DEFAULT 'default',
    custom_models TEXT,
    external_api_configs TEXT,
    developer_mode BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Global models table
  `CREATE TABLE IF NOT EXISTS global_models (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'Box',
    api_model_id VARCHAR(200),
    config_key VARCHAR(100),
    default_base_url VARCHAR(500),
    api_key TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // API usage logs table
  `CREATE TABLE IF NOT EXISTS api_usage_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    model_name VARCHAR(200),
    provider VARCHAR(50),
    tokens_input INT DEFAULT 0,
    tokens_output INT DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_model_id (model_id),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Global settings table
  `CREATE TABLE IF NOT EXISTS global_settings (
    \`key\` VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function runMigrations() {
  console.log('🔄 Starting database migrations...');
  
  const connected = await testConnection();
  if (!connected) {
    console.error('Failed to connect to database. Please check your configuration.');
    process.exit(1);
  }

  for (let i = 0; i < migrations.length; i++) {
    try {
      await query(migrations[i]);
      console.log(`✅ Migration ${i + 1}/${migrations.length} completed`);
    } catch (error: any) {
      // Ignore "table already exists" errors
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error(`❌ Migration ${i + 1} failed:`, error.message);
        throw error;
      }
    }
  }

  console.log('✅ All migrations completed successfully!');
  process.exit(0);
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});

