import { useMemo } from 'react';
import type { Artist, Recommendation } from '../types';
import { ARTISTS, ARTIST_BY_ID, DEMO_USER_ID } from '../data/artists';
import { recommend, scorePair } from './recommendation';
import { useStore } from './store';

/** The signed-in artist. Spotify identity (when connected) overlays name and image. */
export function useViewer(): Artist {
  const auth = useStore((s) => s.auth);
  return useMemo(() => {
    const base = ARTIST_BY_ID[auth?.userId ?? DEMO_USER_ID] ?? ARTIST_BY_ID[DEMO_USER_ID];
    if (auth?.mode === 'spotify' && auth.spotify) {
      return { ...base, name: auth.spotify.artistName || auth.spotify.displayName, imageUrl: auth.spotify.imageUrl, isDemoArtist: false };
    }
    return base;
  }, [auth]);
}

export function useRecommendations(): Recommendation[] {
  const viewer = useViewer();
  const settings = useStore((s) => s.settings);
  const dismissed = useStore((s) => s.dismissed);
  return useMemo(
    () => recommend(viewer, ARTISTS, { adventurousness: settings.adventurousness, lookingFor: settings.lookingFor }, new Set(dismissed)),
    [viewer, settings.adventurousness, settings.lookingFor, dismissed],
  );
}

export function useFit(targetId: string): Recommendation | null {
  const viewer = useViewer();
  const settings = useStore((s) => s.settings);
  return useMemo(() => {
    const t = ARTIST_BY_ID[targetId];
    if (!t || t.id === viewer.id) return null;
    return scorePair(viewer, t, { adventurousness: settings.adventurousness, lookingFor: settings.lookingFor });
  }, [targetId, viewer, settings.adventurousness, settings.lookingFor]);
}
