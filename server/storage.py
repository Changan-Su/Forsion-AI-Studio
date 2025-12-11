"""
MySQL-based storage layer for Forsion AI Studio.
Replaces the previous JSON file-based storage.
"""
from __future__ import annotations

import json
from hashlib import sha256
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from .database import SessionLocal, init_db
from .models import ApiUsageLog, GlobalModel, GlobalSettings, User, UserSettings


def _get_session() -> Session:
    """Get a new database session."""
    return SessionLocal()


def _hash_password(password: str) -> str:
    """Hash password using SHA256."""
    return sha256(password.encode()).hexdigest()


def get_user(username: str) -> Optional[Dict[str, Any]]:
    """Get user by username."""
    with _get_session() as session:
        user = session.query(User).filter(User.username == username).first()
        if user:
            return user.to_dict()
    return None


def create_user(username: str, password: str, role: str = "USER") -> Dict[str, Any]:
    """Create a new user."""
    with _get_session() as session:
        # Check if user already exists
        existing = session.query(User).filter(User.username == username).first()
        if existing:
            raise ValueError("Username exists")
        
        # Create new user
        user_id = str(uuid4()) if username != "admin" else "admin-001"
        user = User(
            id=user_id,
            username=username,
            password=_hash_password(password),
            role=role,
        )
        session.add(user)
        
        # Create default settings for user
        settings = UserSettings(
            id=str(uuid4()),
            user_id=user_id,
            theme="dark" if role == "ADMIN" else "light",
            theme_preset="default",
            custom_models="[]",
            external_api_configs="{}",
        )
        session.add(settings)
        
        session.commit()
        return user.to_dict()


def verify_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Verify user credentials."""
    user = get_user(username)
    if user and user["password"] == _hash_password(password):
        return user
    return None


def update_password(username: str, new_password: str) -> None:
    """Update user password."""
    with _get_session() as session:
        user = session.query(User).filter(User.username == username).first()
        if not user:
            raise ValueError("User not found")
        user.password = _hash_password(new_password)
        session.commit()


def get_settings(username: str) -> Dict[str, Any]:
    """Get user settings."""
    with _get_session() as session:
        user = session.query(User).filter(User.username == username).first()
        if not user or not user.settings:
            return {"externalApiConfigs": {}}
        
        settings = user.settings
        return {
            "theme": settings.theme,
            "themePreset": settings.theme_preset,
            "customModels": json.loads(settings.custom_models or "[]"),
            "externalApiConfigs": json.loads(settings.external_api_configs or "{}"),
        }


def update_settings(username: str, settings_data: Dict[str, Any]) -> Dict[str, Any]:
    """Update user settings."""
    with _get_session() as session:
        user = session.query(User).filter(User.username == username).first()
        if not user:
            raise ValueError("User not found")
        
        # Create settings if not exists
        if not user.settings:
            user.settings = UserSettings(
                id=str(uuid4()),
                user_id=user.id,
            )
        
        settings = user.settings
        
        # Update fields if provided
        if "theme" in settings_data:
            settings.theme = settings_data["theme"]
        if "themePreset" in settings_data:
            settings.theme_preset = settings_data["themePreset"]
        if "customModels" in settings_data:
            settings.custom_models = json.dumps(settings_data["customModels"])
        if "externalApiConfigs" in settings_data:
            settings.external_api_configs = json.dumps(settings_data["externalApiConfigs"])
        
        session.commit()
        
        return {
            "theme": settings.theme,
            "themePreset": settings.theme_preset,
            "customModels": json.loads(settings.custom_models or "[]"),
            "externalApiConfigs": json.loads(settings.external_api_configs or "{}"),
        }


def list_users() -> List[Dict[str, Any]]:
    """List all users."""
    with _get_session() as session:
        users = session.query(User).all()
        return [u.to_dict() for u in users]


def delete_user(username: str) -> None:
    """Delete a user."""
    with _get_session() as session:
        user = session.query(User).filter(User.username == username).first()
        if not user:
            raise ValueError("User not found")
        session.delete(user)
        session.commit()


def get_default_model_id() -> str:
    """Get the default model ID."""
    with _get_session() as session:
        setting = session.query(GlobalSettings).filter(GlobalSettings.key == "defaultModelId").first()
        if setting and setting.value:
            return setting.value
        return "gpt-5"


def set_default_model_id(model_id: str) -> str:
    """Set the default model ID."""
    with _get_session() as session:
        setting = session.query(GlobalSettings).filter(GlobalSettings.key == "defaultModelId").first()
        if setting:
            setting.value = model_id
        else:
            setting = GlobalSettings(key="defaultModelId", value=model_id)
            session.add(setting)
        session.commit()
        return model_id


def ensure_admin_exists() -> None:
    """
    Ensure the default admin user exists.
    Called during application startup.
    """
    # Initialize database tables
    init_db()
    
    # Check if admin user exists
    admin = get_user("admin")
    if not admin:
        create_user("admin", "admin", role="ADMIN")
        print("Created default admin user (username: admin, password: admin)")


# ============ API Usage Logging ============

def log_api_usage(
    username: str,
    model_id: str,
    model_name: str = None,
    provider: str = None,
    tokens_input: int = 0,
    tokens_output: int = 0,
    success: bool = True,
    error_message: str = None
) -> Dict[str, Any]:
    """Log an API usage record."""
    with _get_session() as session:
        log = ApiUsageLog(
            username=username,
            model_id=model_id,
            model_name=model_name,
            provider=provider,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            success=success,
            error_message=error_message,
        )
        session.add(log)
        session.commit()
        session.refresh(log)
        return log.to_dict()


def get_api_usage_stats(
    username: str = None,
    model_id: str = None,
    days: int = 30,
    limit: int = 1000
) -> Dict[str, Any]:
    """Get API usage statistics."""
    from datetime import timedelta
    
    with _get_session() as session:
        from sqlalchemy import func
        
        # Base query
        query = session.query(ApiUsageLog)
        
        # Filter by date range
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(ApiUsageLog.created_at >= cutoff)
        
        if username:
            query = query.filter(ApiUsageLog.username == username)
        if model_id:
            query = query.filter(ApiUsageLog.model_id == model_id)
        
        # Get recent logs
        logs = query.order_by(ApiUsageLog.created_at.desc()).limit(limit).all()
        
        # Calculate stats
        total_requests = query.count()
        successful = query.filter(ApiUsageLog.success == True).count()
        failed = total_requests - successful
        
        # Tokens stats
        token_stats = session.query(
            func.sum(ApiUsageLog.tokens_input).label('total_input'),
            func.sum(ApiUsageLog.tokens_output).label('total_output')
        ).filter(ApiUsageLog.created_at >= cutoff)
        
        if username:
            token_stats = token_stats.filter(ApiUsageLog.username == username)
        if model_id:
            token_stats = token_stats.filter(ApiUsageLog.model_id == model_id)
            
        token_result = token_stats.first()
        
        # Usage by model
        model_stats = session.query(
            ApiUsageLog.model_id,
            ApiUsageLog.model_name,
            func.count(ApiUsageLog.id).label('count'),
            func.sum(ApiUsageLog.tokens_input).label('tokens_in'),
            func.sum(ApiUsageLog.tokens_output).label('tokens_out')
        ).filter(ApiUsageLog.created_at >= cutoff)
        
        if username:
            model_stats = model_stats.filter(ApiUsageLog.username == username)
            
        model_stats = model_stats.group_by(
            ApiUsageLog.model_id, ApiUsageLog.model_name
        ).all()
        
        # Usage by user
        user_stats = session.query(
            ApiUsageLog.username,
            func.count(ApiUsageLog.id).label('count'),
            func.sum(ApiUsageLog.tokens_input).label('tokens_in'),
            func.sum(ApiUsageLog.tokens_output).label('tokens_out')
        ).filter(ApiUsageLog.created_at >= cutoff)
        
        if model_id:
            user_stats = user_stats.filter(ApiUsageLog.model_id == model_id)
            
        user_stats = user_stats.group_by(ApiUsageLog.username).all()
        
        return {
            "total_requests": total_requests,
            "successful": successful,
            "failed": failed,
            "total_tokens_input": token_result.total_input or 0,
            "total_tokens_output": token_result.total_output or 0,
            "by_model": [
                {
                    "model_id": m.model_id,
                    "model_name": m.model_name,
                    "count": m.count,
                    "tokens_input": m.tokens_in or 0,
                    "tokens_output": m.tokens_out or 0
                }
                for m in model_stats
            ],
            "by_user": [
                {
                    "username": u.username,
                    "count": u.count,
                    "tokens_input": u.tokens_in or 0,
                    "tokens_output": u.tokens_out or 0
                }
                for u in user_stats
            ],
            "recent_logs": [log.to_dict() for log in logs[:100]]
        }


# ============ Global Models Management ============

def list_global_models(include_disabled: bool = False, include_api_keys: bool = False) -> List[Dict[str, Any]]:
    """List all global models.
    
    Args:
        include_disabled: If True, include disabled models (for admin view)
        include_api_keys: If True, include API keys in response (for admin view)
    """
    with _get_session() as session:
        query = session.query(GlobalModel)
        if not include_disabled:
            query = query.filter(GlobalModel.is_enabled == True)
        models = query.all()
        
        result = []
        for m in models:
            model_dict = m.to_dict()
            if include_api_keys:
                model_dict["apiKey"] = m.api_key
            result.append(model_dict)
        return result


def get_global_model(model_id: str) -> Optional[Dict[str, Any]]:
    """Get a global model by ID."""
    with _get_session() as session:
        model = session.query(GlobalModel).filter(GlobalModel.id == model_id).first()
        if model:
            result = model.to_dict()
            result["apiKey"] = model.api_key  # Include API key for admin
            return result
        return None


def create_global_model(
    model_id: str,
    name: str,
    provider: str,
    description: str = None,
    icon: str = "Box",
    api_model_id: str = None,
    config_key: str = None,
    default_base_url: str = None,
    api_key: str = None
) -> Dict[str, Any]:
    """Create a new global model."""
    with _get_session() as session:
        existing = session.query(GlobalModel).filter(GlobalModel.id == model_id).first()
        if existing:
            raise ValueError("Model ID already exists")
        
        model = GlobalModel(
            id=model_id,
            name=name,
            provider=provider,
            description=description,
            icon=icon,
            api_model_id=api_model_id,
            config_key=config_key,
            default_base_url=default_base_url,
            api_key=api_key,
        )
        session.add(model)
        session.commit()
        result = model.to_dict()
        result["apiKey"] = model.api_key  # Include API key for admin
        return result


def update_global_model(model_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update a global model."""
    with _get_session() as session:
        model = session.query(GlobalModel).filter(GlobalModel.id == model_id).first()
        if not model:
            raise ValueError("Model not found")
        
        if "name" in updates:
            model.name = updates["name"]
        if "provider" in updates:
            model.provider = updates["provider"]
        if "description" in updates:
            model.description = updates["description"]
        if "icon" in updates:
            model.icon = updates["icon"]
        if "apiModelId" in updates:
            model.api_model_id = updates["apiModelId"]
        if "configKey" in updates:
            model.config_key = updates["configKey"]
        if "defaultBaseUrl" in updates:
            model.default_base_url = updates["defaultBaseUrl"]
        if "apiKey" in updates:
            model.api_key = updates["apiKey"]
        if "isEnabled" in updates:
            model.is_enabled = updates["isEnabled"]
        
        session.commit()
        result = model.to_dict()
        result["apiKey"] = model.api_key  # Include API key for admin
        return result


def delete_global_model(model_id: str) -> None:
    """Delete a global model."""
    with _get_session() as session:
        model = session.query(GlobalModel).filter(GlobalModel.id == model_id).first()
        if model:
            session.delete(model)
            session.commit()


# ============ Developer Mode Settings ============

def get_developer_mode(username: str) -> bool:
    """Check if developer mode is enabled for a user."""
    settings = get_settings(username)
    # Developer mode stored in external_api_configs as a special key
    configs = settings.get("externalApiConfigs", {})
    return configs.get("_developerMode", {}).get("enabled", False)


def set_developer_mode(username: str, enabled: bool) -> None:
    """Set developer mode for a user."""
    with _get_session() as session:
        user = session.query(User).filter(User.username == username).first()
        if not user or not user.settings:
            return
        
        configs = json.loads(user.settings.external_api_configs or "{}")
        configs["_developerMode"] = {"enabled": enabled}
        user.settings.external_api_configs = json.dumps(configs)
        session.commit()


from datetime import datetime
