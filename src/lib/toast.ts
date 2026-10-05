import { useSyncExternalStore } from 'react';

export interface Toast { id: number; text: string; action?: { label: string; href: string }; tone?: 'green' | 'plain' }
let toasts: Toast[] = [];
const ls = new Set<() => void>();
let n = 0;

export function toast(text: string, opts: Omit<Toast, 'id' | 'text'> = {}) {
  const t = { id: ++n, text, ...opts };
  toasts = [...toasts, t];
  ls.forEach((l) => l());
  setTimeout(() => dismissToast(t.id), opts.action ? 7000 : 3600);
}
export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  ls.forEach((l) => l());
}
export function useToasts() {
  return useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => toasts, () => toasts);
}
