import { useSyncExternalStore } from 'react';

// Global sheets that many screens open: "Why this artist?" and "Invite".
export type Overlay = { kind: 'why'; artistId: string } | { kind: 'invite'; artistId: string } | { kind: 'notifications' } | null;
let current: Overlay = null;
const ls = new Set<() => void>();
export function openOverlay(o: Overlay) { current = o; ls.forEach((l) => l()); }
export const closeOverlay = () => openOverlay(null);
export function useOverlay() {
  return useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => current, () => current);
}
