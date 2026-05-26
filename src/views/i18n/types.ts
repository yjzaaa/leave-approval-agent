/**
 * i18next 类型增强 — IDE 键自动补全
 * 导入 zh-CN 翻译作为类型源，所有语言共享相同键结构
 */
import type translation from './locales/zh-CN/translation.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof translation;
    };
  }
}
