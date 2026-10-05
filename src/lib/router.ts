import { useSyncExternalStore } from 'react';

// Tiny hash router: #/discover, #/artist/lena-cruz, #/channels/ch_123
const read = () => (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
const sub = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): string[] {
  const path = useSyncExternalStore(sub, read, read);
  return path ? path.split('/').map(decodeURIComponent) : [];
}

export function navigate(path: string) {
  const target = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
  if (location.hash !== target) location.hash = target;
}

export const href = (path: string) => `#/${path.replace(/^\//, '')}`;
