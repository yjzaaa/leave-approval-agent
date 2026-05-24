/**
 * i18next 初始化 — 浏览器语言自适应
 * 检测优先级: localStorage(手动切换) > navigator.language(系统) > zh-CN(兜底)
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN/translation.json';
import en from './locales/en/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      en: { translation: en },
    },
    fallbackLng: 'zh-CN',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18next_lng',
      convertDetectedLanguage: (lng) => {
        if (lng.startsWith('zh')) return 'zh-CN';
        if (lng.startsWith('en')) return 'en';
        return 'zh-CN';
      },
    },
    interpolation: {
      escapeValue: false,
    },
    returnObjects: true,
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  document.title = lng === 'en'
    ? 'Approval Assistant — Leave Approval Agent'
    : '审批助手 — Leave Approval Agent';
  const desc = document.querySelector('meta[name="description"]');
  if (desc) {
    desc.setAttribute('content', lng === 'en'
      ? 'Enterprise Leave Approval Agent'
      : '远程办公申请自动化审批 Agent');
  }
});

export default i18n;
