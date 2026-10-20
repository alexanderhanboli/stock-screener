export const STATIC_DATA_NOTICE = import.meta.env.VITE_STATIC_DATA_NOTICE || '';
export const STATIC_CHINESE_NAV = import.meta.env.VITE_STATIC_LOCALE === 'zh-CN';
export const STATIC_NAV_LABELS = STATIC_CHINESE_NAV ? {
  '/': '每日概览', '/scan': '股票扫描', '/breadth': '市场宽度', '/groups': '行业轮动',
} : {};
