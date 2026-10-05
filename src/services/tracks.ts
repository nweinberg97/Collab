import type { Track } from '../types';
import { TRACK_BY_ID } from '../data/artists';
import { getState } from './store';

export function getTrack(id: string): Track | undefined {
  return TRACK_BY_ID[id] ?? getState().extraTracks[id];
}
