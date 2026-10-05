import type { Notification } from '../types';
import { update } from './store';
import { uid } from '../lib/music';

export function notify(n: Omit<Notification, 'id' | 'read' | 'at'>) {
  update((s) => {
    s.notifications.unshift({ ...n, id: uid('nt'), read: false, at: Date.now() });
    s.notifications = s.notifications.slice(0, 30);
  });
}

export function markAllRead() {
  update((s) => { s.notifications.forEach((n) => { n.read = true; }); });
}
