import dotenv from 'dotenv';
dotenv.config();

import { testConnection } from '../config/database.js';
import { createUser, getUserByUsername } from '../services/userService.js';
import { createGlobalModel, getGlobalModel } from '../services/modelService.js';
import { setDefaultModelId } from '../services/settingsService.js';

async function seed() {
  console.log('🌱 Starting database seeding...');

  const connected = await testConnection();
  if (!connected) {
    console.error('Failed to connect to database.');
    process.exit(1);
  }

  // Create admin user
  const adminExists = await getUserByUsername('admin');
  if (!adminExists) {
    await createUser('admin', process.env.ADMIN_PASSWORD || 'admin', 'ADMIN');
    console.log('✅ Created admin user');
  } else {
    console.log('ℹ️ Admin user already exists');
  }

  // Note: No builtin models are auto-added anymore.
  // Models should be added via the Admin Panel.
  console.log('ℹ️ No builtin models added. Add models via Admin Panel.');

  console.log('✅ Database seeding completed!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});

