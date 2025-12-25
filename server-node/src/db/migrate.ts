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
    nickname VARCHAR(100),
    avatar MEDIUMTEXT,
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
    avatar MEDIUMTEXT,
    api_model_id VARCHAR(200),
    config_key VARCHAR(100),
    default_base_url VARCHAR(500),
    api_key TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    prompt_caching_enabled BOOLEAN DEFAULT FALSE,
    system_prompt TEXT,
    cacheable_content TEXT,
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

  // Invite codes table
  `CREATE TABLE IF NOT EXISTS invite_codes (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    max_uses INT NOT NULL DEFAULT 1,
    used_count INT DEFAULT 0,
    initial_credits DECIMAL(10, 2) DEFAULT 0.00,
    created_by VARCHAR(36),
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_is_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // User credits table
  `CREATE TABLE IF NOT EXISTS user_credits (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) UNIQUE NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    total_earned DECIMAL(10, 2) DEFAULT 0.00,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Credit transactions table
  `CREATE TABLE IF NOT EXISTS credit_transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type ENUM('initial', 'usage', 'refund', 'bonus', 'adjustment') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    balance_before DECIMAL(10, 2) NOT NULL,
    balance_after DECIMAL(10, 2) NOT NULL,
    description TEXT,
    reference_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Credit pricing table
  `CREATE TABLE IF NOT EXISTS credit_pricing (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(100) NOT NULL,
    provider VARCHAR(50),
    tokens_per_credit DECIMAL(10, 4) NOT NULL DEFAULT 100.0,
    input_multiplier DECIMAL(10, 4) DEFAULT 1.0,
    output_multiplier DECIMAL(10, 4) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_model (model_id),
    INDEX idx_model_id (model_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  
  // Add prompt caching fields to global_models (migration for existing tables)
  // Note: This will fail if columns already exist, which is fine - we catch the error
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
      // Ignore "table already exists" and "duplicate column" errors
      if (error.code !== 'ER_TABLE_EXISTS_ERROR' && 
          error.code !== 'ER_DUP_FIELDNAME' &&
          !error.message.includes('Duplicate column name')) {
        console.error(`❌ Migration ${i + 1} failed:`, error.message);
        throw error;
      } else {
        console.log(`⚠️  Migration ${i + 1} skipped (already exists)`);
      }
    }
  }
  
  // Add prompt caching columns if they don't exist (separate try-catch for each)
  try {
    await query(`ALTER TABLE global_models ADD COLUMN system_prompt TEXT AFTER is_enabled`);
    console.log('✅ Added system_prompt column');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME' && !error.message.includes('Duplicate column name')) {
      console.warn('⚠️  Could not add system_prompt column:', error.message);
    }
  }
  
  try {
    await query(`ALTER TABLE global_models ADD COLUMN cacheable_content TEXT AFTER system_prompt`);
    console.log('✅ Added cacheable_content column');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME' && !error.message.includes('Duplicate column name')) {
      console.warn('⚠️  Could not add cacheable_content column:', error.message);
    }
  }
  
  try {
    await query(`ALTER TABLE global_models ADD COLUMN prompt_caching_enabled BOOLEAN DEFAULT FALSE AFTER is_enabled`);
    console.log('✅ Added prompt_caching_enabled column');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME' && !error.message.includes('Duplicate column name')) {
      console.warn('⚠️  Could not add prompt_caching_enabled column:', error.message);
    }
  }

  try {
    await query(`ALTER TABLE global_models ADD COLUMN avatar MEDIUMTEXT AFTER icon`);
    console.log('✅ Added avatar column');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME' && !error.message.includes('Duplicate column name')) {
      console.warn('⚠️  Could not add avatar column:', error.message);
    }
  }

  // Add nickname and avatar to user_settings
  try {
    await query(`ALTER TABLE user_settings ADD COLUMN nickname VARCHAR(100) AFTER user_id`);
    console.log('✅ Added nickname column to user_settings');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME' && !error.message.includes('Duplicate column name')) {
      console.warn('⚠️  Could not add nickname column:', error.message);
    }
  }

  try {
    await query(`ALTER TABLE user_settings ADD COLUMN avatar MEDIUMTEXT AFTER nickname`);
    console.log('✅ Added avatar column to user_settings');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME' && !error.message.includes('Duplicate column name')) {
      console.warn('⚠️  Could not add avatar column:', error.message);
    }
  }

  // Add developer_mode column if it doesn't exist
  try {
    await query(`ALTER TABLE user_settings ADD COLUMN developer_mode BOOLEAN DEFAULT FALSE AFTER external_api_configs`);
    console.log('✅ Added developer_mode column to user_settings');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME' && !error.message.includes('Duplicate column name')) {
      console.warn('⚠️  Could not add developer_mode column:', error.message);
    }
  }

  // Add project_source column to api_usage_logs for tracking API call origin
  try {
    await query(`ALTER TABLE api_usage_logs ADD COLUMN project_source VARCHAR(50) DEFAULT 'ai-studio' COMMENT 'Project source: ai-studio, desktop, calendar, etc.' AFTER provider`);
    console.log('✅ Added project_source column to api_usage_logs');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_FIELDNAME' && !error.message.includes('Duplicate column name')) {
      console.warn('⚠️  Could not add project_source column:', error.message);
    }
  }

  // Add index for project_source
  try {
    await query(`ALTER TABLE api_usage_logs ADD INDEX idx_project_source (project_source)`);
    console.log('✅ Added index for project_source');
  } catch (error: any) {
    if (error.code !== 'ER_DUP_KEYNAME' && !error.message.includes('Duplicate key name')) {
      console.warn('⚠️  Could not add index for project_source:', error.message);
    }
  }

  console.log('✅ All migrations completed successfully!');
  process.exit(0);
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});


