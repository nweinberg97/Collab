// Sanity checks for the Collaboration Fit model. Run: npm test
import { ARTISTS, ARTIST_BY_ID, DEMO_USER_ID } from '../src/data/artists';
import { recommend, overlapPercent, calibrate } from '../src/services/recommendation';
import { camelot } from '../src/lib/music';
import assert from 'node:assert/strict';

const alex = ARTIST_BY_ID[DEMO_USER_ID];
for (const adv of [0, 0.5, 1]) {
  const recs = recommend(alex, ARTISTS, { adventurousness: adv, lookingFor: ['Producer', 'Co-writer', 'Feature'] });
  console.log(`\nadventurousness ${adv}`);
  for (const r of recs.slice(0, 12)) {
    const s = r.signals;
    console.log(`${String(r.score).padStart(3)}  ${ARTIST_BY_ID[r.targetArtistId].name.padEnd(18)} sim=${r.similarity.toFixed(2)} g=${s.genreCompatibility.toFixed(2)} t=${s.tempoCompatibility.toFixed(2)} k=${s.keyCompatibility.toFixed(2)} aud=${overlapPercent(s.audienceOverlap)}% m=${s.growthMomentum.toFixed(2)} c=${s.creativeContrast.toFixed(2)}`);
  }
  console.log('bottom:', recs.slice(-3).map(r => `${ARTIST_BY_ID[r.targetArtistId].name} ${r.score}`).join(', '));
}
assert.equal(camelot('A minor').code, '8A');
assert.equal(camelot('C major').code, '8B');
assert.equal(camelot('Bb major').code, '6B');
assert.equal(calibrate(0), 0);
assert.ok(calibrate(1) === 100);
const recs = recommend(alex, ARTISTS, { adventurousness: 0.5, lookingFor: ['Producer', 'Co-writer', 'Feature'] });
assert.equal(recs[0].targetArtistId, 'lena-cruz', 'Lena should be the top match at default settings');
console.log('\n✓ recommendation checks passed');
