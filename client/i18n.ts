import React, { createContext, useContext } from 'react';
import type { Locale } from './types';

const en: Record<string, string> = {
  // Header
  'header.title': 'Forsion AI Studio',

  // Sidebar
  'sidebar.newChat': 'New Chat',
  'sidebar.history': 'History',
  'sidebar.noHistory': 'No history yet.',
  'sidebar.archived': 'Archived',
  'sidebar.account': 'Account',
  'sidebar.settings': 'Settings',
  'sidebar.logout': 'Log Out',

  // Input
  'input.placeholder': 'Message {model}...',
  'input.placeholderExpanded': 'Message {model}... (Ctrl+Enter to send)',
  'input.deepThinking': 'Deep Thinking',
  'input.deepThinkingDesc': 'Enhanced reasoning enabled',
  'input.forceImage': 'Force Image',
  'input.forceImageDesc': 'Will generate image',
  'input.agent': 'Agent',
  'input.files': 'Files',
  'input.send': 'Send',
  'input.stop': 'Stop',
  'input.attachFile': 'Attach File',
  'input.expand': 'Expand',
  'input.collapse': 'Collapse',

  // Chat area
  'chat.empty.title': 'Forsion AI Studio',
  'chat.empty.subtitle': 'Start a conversation with {model}.',
  'chat.processing': 'Processing request',
  'chat.dropToUpload': 'Drop file here',
  'chat.dropHint': 'Images, PDF, Word, Text files',
  'chat.copy': 'Copy',
  'chat.copied': 'Copied!',
  'chat.regenerate': 'Regenerate response',
  'chat.deepThinking': 'Deep Thinking',
  'chat.thinkingHint': 'Click to view thinking process...',

  // Suggestions
  'suggest.code': 'Write some code',
  'suggest.explain': 'Explain a concept',
  'suggest.image': 'Generate an image',
  'suggest.creative': 'Creative writing',

  // Settings
  'settings.title': 'Settings',
  'settings.tab.general': 'General',
  'settings.tab.skills': 'Skills',
  'settings.tab.agent': 'Agent',
  'settings.tab.account': 'Account',
  'settings.tab.developer': 'Developer',
  'settings.appearance': 'Appearance',
  'settings.lightMode': 'Light',
  'settings.darkMode': 'Dark',
  'settings.themePreset': 'Theme Preset',
  'settings.profile': 'Profile',
  'settings.nickname': 'Nickname',
  'settings.saveProfile': 'Save Profile',
  'settings.apiConfig': 'API Configuration',

  // Models
  'model.selectModel': 'Select Model',
  'model.noModels': 'No models configured',
  'model.noModelsHint': 'Enable Developer Mode in Settings to add models, or contact admin.',

  // Errors
  'error.fileTooLarge': 'File too large',
  'error.fileTooLargeDesc': '{name} ({size}) exceeds the 10MB limit.',
  'error.fileTypeNotSupported': 'Supported files: Images, PDF, Word (.doc, .docx), Text files',
  'error.sessionExpired': 'Session expired. Please sign in again.',

  // Misc
  'misc.disclaimer': 'AI can make mistakes. Please verify important information.',
  'misc.offline': 'Offline Mode',
  'misc.reconnect': 'Reconnect',
};

const zh: Record<string, string> = {
  // Header
  'header.title': 'Forsion AI 工作室',

  // Sidebar
  'sidebar.newChat': '新对话',
  'sidebar.history': '历史记录',
  'sidebar.noHistory': '暂无历史记录',
  'sidebar.archived': '已归档',
  'sidebar.account': '账户',
  'sidebar.settings': '设置',
  'sidebar.logout': '退出登录',

  // Input
  'input.placeholder': '给 {model} 发消息...',
  'input.placeholderExpanded': '给 {model} 发消息... (Ctrl+Enter 发送)',
  'input.deepThinking': '深度思考',
  'input.deepThinkingDesc': '已启用增强推理',
  'input.forceImage': '强制绘图',
  'input.forceImageDesc': '将生成图片',
  'input.agent': '智能体',
  'input.files': '文件',
  'input.send': '发送',
  'input.stop': '停止',
  'input.attachFile': '添加附件',
  'input.expand': '展开',
  'input.collapse': '收起',

  // Chat area
  'chat.empty.title': 'Forsion AI 工作室',
  'chat.empty.subtitle': '开始与 {model} 对话。',
  'chat.processing': '正在处理请求',
  'chat.dropToUpload': '拖放文件到这里',
  'chat.dropHint': '支持图片、PDF、Word、文本文件',
  'chat.copy': '复制',
  'chat.copied': '已复制!',
  'chat.regenerate': '重新生成',
  'chat.deepThinking': '深度思考',
  'chat.thinkingHint': '点击查看思考过程...',

  // Suggestions
  'suggest.code': '写一段代码',
  'suggest.explain': '解释一个概念',
  'suggest.image': '生成一张图片',
  'suggest.creative': '创意写作',

  // Settings
  'settings.title': '设置',
  'settings.tab.general': '通用',
  'settings.tab.skills': '技能',
  'settings.tab.agent': '智能体',
  'settings.tab.account': '账户',
  'settings.tab.developer': '开发者',
  'settings.appearance': '外观',
  'settings.lightMode': '浅色',
  'settings.darkMode': '深色',
  'settings.themePreset': '主题预设',
  'settings.profile': '个人资料',
  'settings.nickname': '昵称',
  'settings.saveProfile': '保存资料',
  'settings.apiConfig': 'API 配置',

  // Models
  'model.selectModel': '选择模型',
  'model.noModels': '未配置模型',
  'model.noModelsHint': '在设置中启用开发者模式以添加模型，或联系管理员。',

  // Errors
  'error.fileTooLarge': '文件过大',
  'error.fileTooLargeDesc': '{name} ({size}) 超过 10MB 限制。',
  'error.fileTypeNotSupported': '支持的文件：图片、PDF、Word (.doc, .docx)、文本文件',
  'error.sessionExpired': '会话已过期，请重新登录。',

  // Misc
  'misc.disclaimer': 'AI 可能会犯错，请核实重要信息。',
  'misc.offline': '离线模式',
  'misc.reconnect': '重新连接',
};

const translations: Record<Locale, Record<string, string>> = { en, zh };

export function t(key: string, locale: Locale, params?: Record<string, string>): string {
  let str = translations[locale]?.[key] ?? translations.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

interface I18nContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string>) => string;
}

export const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  t: (key) => key,
});

export const useI18n = () => useContext(I18nContext);
