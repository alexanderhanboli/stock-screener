// Shared by StaticLayout (tab titles, repo link) and vite.config.js (static <head> tags).
export const SITE_NAME = import.meta.env?.VITE_STATIC_SITE_NAME || 'Stock Scanner Daily';
export const SITE_TITLE = `${SITE_NAME}: free daily stock scans, breadth and group rankings`;
export const SITE_DESCRIPTION = 'Free, open-source daily stock scans for 12 markets: Minervini, CANSLIM and VCP screens, '
  + 'market breadth, IBD-style group rankings and relative rotation. Updated after each market close.';
// Forks may opt in to a different repository link; upstream remains the default.
export const REPO_URL = import.meta.env?.VITE_STATIC_REPO_URL || 'https://github.com/xang1234/stock-screener';
