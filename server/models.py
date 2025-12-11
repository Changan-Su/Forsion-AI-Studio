"""
SQLAlchemy ORM models for Forsion AI Studio.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    """User account model."""
    
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password = Column(String(64), nullable=False)  # SHA256 hash
    role = Column(String(20), nullable=False, default="USER")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to settings
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "password": self.password,
            "role": self.role,
        }


class UserSettings(Base):
    """User settings model."""
    
    __tablename__ = "user_settings"
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    theme = Column(String(20), default="light")
    theme_preset = Column(String(50), default="default")
    custom_models = Column(Text, default="[]")  # JSON string
    external_api_configs = Column(Text, default="{}")  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to user
    user = relationship("User", back_populates="settings")


class GlobalSettings(Base):
    """Global application settings model."""
    
    __tablename__ = "global_settings"
    
    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ApiUsageLog(Base):
    """API usage logging model for tracking requests."""
    
    __tablename__ = "api_usage_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), nullable=False, index=True)
    model_id = Column(String(100), nullable=False, index=True)
    model_name = Column(String(200), nullable=True)
    provider = Column(String(50), nullable=True)  # gemini, openai, deepseek, etc.
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "model_id": self.model_id,
            "model_name": self.model_name,
            "provider": self.provider,
            "tokens_input": self.tokens_input,
            "tokens_output": self.tokens_output,
            "success": self.success,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class GlobalModel(Base):
    """Global model configuration (admin-managed models available to all users)."""
    
    __tablename__ = "global_models"
    
    id = Column(String(100), primary_key=True)
    name = Column(String(200), nullable=False)
    provider = Column(String(50), nullable=False)  # gemini, external
    description = Column(Text, nullable=True)
    icon = Column(String(50), default="Box")
    api_model_id = Column(String(200), nullable=True)
    config_key = Column(String(100), nullable=True)
    default_base_url = Column(String(500), nullable=True)
    api_key = Column(Text, nullable=True)  # Encrypted in production
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "description": self.description,
            "icon": self.icon,
            "apiModelId": self.api_model_id,
            "configKey": self.config_key,
            "defaultBaseUrl": self.default_base_url,
            "isEnabled": self.is_enabled,
        }

