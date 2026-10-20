import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Opt in to a single embedding origin. Never broadcast routes to arbitrary parents.
export default function ParentRouteBridge() {
  const { pathname, search } = useLocation();
  const parentOrigin = import.meta.env.VITE_STATIC_EMBED_PARENT_ORIGIN;
  useEffect(() => {
    if (!parentOrigin || window.parent === window) return;
    let origin;
    try {
      const url = new URL(parentOrigin);
      if (!['https:', 'http:'].includes(url.protocol) || url.origin !== parentOrigin) return;
      origin = url.origin;
    } catch { return; }
    window.parent.postMessage({ type: 'hengyuan-screener-route', route: pathname + search }, origin);
  }, [pathname, search, parentOrigin]);
  return null;
}
