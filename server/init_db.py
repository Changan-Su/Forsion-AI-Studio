#!/usr/bin/env python3
"""
Database initialization script for Forsion AI Studio.

This script:
1. Creates all database tables
2. Creates the default admin user (if not exists)
3. Optionally migrates data from the old JSON file

Usage:
    python -m server.init_db [--migrate]
    
Options:
    --migrate    Migrate existing data from data.json to MySQL
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from server.database import init_db, SessionLocal
from server.models import User, UserSettings, GlobalSettings
from server.storage import ensure_admin_exists, _hash_password
from uuid import uuid4


def migrate_from_json():
    """Migrate data from data.json to MySQL database."""
    json_file = Path(__file__).with_name("data.json")
    
    if not json_file.exists():
        print("No data.json file found, skipping migration.")
        return
    
    print(f"Migrating data from {json_file}...")
    
    try:
        data = json.loads(json_file.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Error reading data.json: {e}")
        return
    
    session = SessionLocal()
    
    try:
        # Migrate users
        users_data = data.get("users", [])
        settings_data = data.get("settings", {})
        
        for user_data in users_data:
            username = user_data.get("username")
            
            # Check if user already exists
            existing = session.query(User).filter(User.username == username).first()
            if existing:
                print(f"  User '{username}' already exists, skipping...")
                continue
            
            # Create user
            user = User(
                id=user_data.get("id", str(uuid4())),
                username=username,
                password=user_data.get("password"),  # Already hashed
                role=user_data.get("role", "USER"),
            )
            session.add(user)
            session.flush()  # Get user ID
            
            # Create user settings
            user_settings = settings_data.get(username, {})
            settings = UserSettings(
                id=str(uuid4()),
                user_id=user.id,
                theme=user_settings.get("theme", "light"),
                theme_preset=user_settings.get("themePreset", "default"),
                custom_models=json.dumps(user_settings.get("customModels", [])),
                external_api_configs=json.dumps(user_settings.get("externalApiConfigs", {})),
            )
            session.add(settings)
            
            print(f"  Migrated user: {username}")
        
        # Migrate global settings
        default_model_id = data.get("defaultModelId")
        if default_model_id:
            existing = session.query(GlobalSettings).filter(GlobalSettings.key == "defaultModelId").first()
            if not existing:
                setting = GlobalSettings(key="defaultModelId", value=default_model_id)
                session.add(setting)
                print(f"  Migrated defaultModelId: {default_model_id}")
        
        session.commit()
        print("Migration completed successfully!")
        
        # Backup old file
        backup_file = json_file.with_suffix(".json.bak")
        json_file.rename(backup_file)
        print(f"Old data.json backed up to {backup_file}")
        
    except Exception as e:
        session.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description="Initialize Forsion AI Studio database")
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Migrate existing data from data.json to MySQL",
    )
    args = parser.parse_args()
    
    print("Initializing database...")
    
    # Create tables
    init_db()
    print("Database tables created.")
    
    # Ensure admin exists
    ensure_admin_exists()
    
    # Optionally migrate data
    if args.migrate:
        migrate_from_json()
    
    print("\nDatabase initialization complete!")
    print("You can now start the server with: uvicorn server.main:app --reload")


if __name__ == "__main__":
    main()


