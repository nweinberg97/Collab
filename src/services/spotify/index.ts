import { DemoSpotifyService } from './DemoSpotifyService';
import { SpotifyAPIService } from './SpotifyAPIService';
import type { SpotifyService } from './SpotifyService';

// Real integration first, graceful fallback second.
const real = new SpotifyAPIService();
const demo = new DemoSpotifyService();

export const spotifyAvailable = real.canConnect;

/** The active service: real when configured and signed in, demo otherwise. */
export function spotify(): SpotifyService {
  return real.canConnect && real.isAuthenticated() ? real : demo;
}

export { real as spotifyAPI, demo as spotifyDemo };
export type { SpotifyService } from './SpotifyService';
