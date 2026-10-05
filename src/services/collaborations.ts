import type { Stage } from '../types';
import { STAGES } from '../types';
import { getState, update } from './store';
import { uid } from '../lib/music';
import { me } from './channels';

// ─── CollaborationService: lightweight projects, not project management ──────

export function createCollaboration(channelId: string, name: string): string {
  const ch = getState().channels[channelId];
  const id = uid('co');
  update((s) => {
    const c = s.channels[channelId];
    const notes = c.messages.filter((m) => m.kind === 'note').map((m) => ({ id: uid('n'), by: m.senderId, text: m.content, at: m.timestamp }));
    const momentTracks = Array.from(new Set(c.moments.map((m) => m.trackId)));
    s.collaborations.unshift({
      id,
      participantIds: [...c.participantIds],
      name: name.trim() || 'Untitled',
      status: 'Exploring',
      channelId,
      trackIds: momentTracks.length ? momentTracks : c.playback.trackId ? [c.playback.trackId] : [],
      notes,
      lastActivity: c.moments.length ? `${c.moments.length} moment${c.moments.length > 1 ? 's' : ''} saved from the channel` : 'Collaboration started',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    c.collaborationId = id;
    c.messages.push({ id: uid('m'), channelId, senderId: 'system', content: `You started “${name.trim() || 'Untitled'}”`, kind: 'system', timestamp: Date.now() });
  });
  void ch;
  return id;
}

export function setStage(collabId: string, stage: Stage) {
  update((s) => {
    const c = s.collaborations.find((x) => x.id === collabId);
    if (c) { c.status = stage; c.lastActivity = `Moved to ${stage}`; c.updatedAt = Date.now(); }
  });
}

export function renameCollaboration(collabId: string, name: string) {
  update((s) => {
    const c = s.collaborations.find((x) => x.id === collabId);
    if (c && name.trim()) { c.name = name.trim(); c.updatedAt = Date.now(); }
  });
}

export function addCollabNote(collabId: string, text: string) {
  if (!text.trim()) return;
  update((s) => {
    const c = s.collaborations.find((x) => x.id === collabId);
    if (c) { c.notes.unshift({ id: uid('n'), by: me(), text: text.trim(), at: Date.now() }); c.lastActivity = 'Note added'; c.updatedAt = Date.now(); }
  });
}

export const stageIndex = (s: Stage) => STAGES.indexOf(s);
