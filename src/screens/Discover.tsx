import { useEffect, useState } from 'react';
import { RecCard, RecHero } from '../components/cards';
import { Button, Segmented } from '../components/ui';
import { useRecommendations } from '../services/hooks';
import { update, useStore } from '../services/store';
import { ARTIST_BY_ID } from '../data/artists';
import { toast } from '../lib/toast';
import { navigate } from '../lib/router';

const PAGE = 8;

export function Discover() {
  const recs = useRecommendations();
  const settings = useStore((s) => s.settings);
  const dismissed = useStore((s) => s.dismissed);
  const [batch, setBatch] = useState(0);
  const [lastDismissed, setLastDismissed] = useState<string | null>(null);
  useEffect(() => { update((s) => { s.newMatchesSeen = true; }); }, []);

  const visible = recs.slice(0, PAGE + batch * 4);
  const [hero, ...rest] = visible;

  const dismiss = (id: string) => {
    update((s) => { if (!s.dismissed.includes(id)) s.dismissed.push(id); });
    setLastDismissed(id);
    toast(`${ARTIST_BY_ID[id].name} hidden. A new match slid in.`);
  };

  const mode = settings.adventurousness < 0.34 ? 'close' : settings.adventurousness > 0.66 ? 'surprise' : 'balanced';

  return (
    <div className="page discover">
      <header className="page-head discover__head">
        <div>
          <p className="eyebrow eyebrow--green">Suggested for You</p>
          <h1 className="display">Artists Collab thinks you should meet.</h1>
          <p className="page-head__sub">Collab found {Math.min(PAGE, recs.length)} artists you should meet this week, ranked by Collaboration Fit across sound, audience and momentum.</p>
        </div>
        <div className="discover__tune">
          <span className="eyebrow">Tune the mix</span>
          <Segmented
            label="Adventurousness"
            value={mode}
            onChange={(v) => update((s) => { s.settings.adventurousness = v === 'close' ? 0.15 : v === 'surprise' ? 0.85 : 0.5; })}
            options={[{ value: 'close', label: 'Close' }, { value: 'balanced', label: '70/30' }, { value: 'surprise', label: 'Surprise me' }]}
          />
        </div>
      </header>

      {hero && <RecHero rec={hero} rank={1} total={visible.length} key={hero.targetArtistId} />}

      <section aria-label="More suggestions">
        <div className="rec-grid">
          {rest.map((r, i) => <RecCard key={r.targetArtistId} rec={r} index={i} onDismiss={() => dismiss(r.targetArtistId)} />)}
        </div>
        <div className="discover__more">
          {recs.length > visible.length && <Button variant="secondary" icon="refresh" onClick={() => setBatch((b) => b + 1)}>Show 4 more matches</Button>}
          {lastDismissed && dismissed.length > 0 && (
            <Button variant="quiet" onClick={() => { update((s) => { s.dismissed = []; }); setLastDismissed(null); }}>Restore {dismissed.length} hidden</Button>
          )}
          <Button variant="quiet" iconRight="arrowRight" onClick={() => navigate('rising')}>Looking further out? Rising Talent</Button>
        </div>
      </section>
    </div>
  );
}
