exports.handler = async function(event) {
  const round = event.queryStringParameters?.round || '3';
  const key = 'f5d9837e828cc18f400eb5f24bb0';

  // Scrape ESPN golf leaderboard page — extracts embedded JSON
  try {
    const r = await fetch('https://www.espn.com/golf/leaderboard', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (r.ok) {
      const html = await r.text();

      // ESPN embeds leaderboard data as JSON in the page
      // Pattern: competitors:[{...}] 
      const match = html.match(/competitors":\s*(\[[\s\S]*?\])\s*,"rawText/);
      if (match) {
        const competitors = JSON.parse(match[1]);
        const players = competitors.map(c => {
          const today = c.toPar === 'E' ? 0 : parseInt(c.toPar) || 0;
          return {
            name: c.name || c.displayName || '',
            today,
            total: today,
            thru: parseInt(c.thru) || 0,
            position: c.pos || ''
          };
        }).filter(p => p.name);

        if (players.length > 0) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
              source: 'espn-scrape',
              event_name: 'Masters Tournament 2026',
              last_updated: new Date().toISOString(),
              players
            })
          };
        }
      }

      // Try alternate JSON pattern in ESPN page
      const match2 = html.match(/"leaderboard":\s*\{[\s\S]*?"players":\s*(\[[\s\S]*?\])\s*[,}]/);
      if (match2) {
        try {
          const playersRaw = JSON.parse(match2[1]);
          const players = playersRaw.map(p => ({
            name: p.athlete?.displayName || p.displayName || p.name || '',
            today: p.linescores?.find(l => String(l.period) === round)?.value || parseInt(p.toPar) || 0,
            total: parseInt(p.total || p.toPar) || 0,
            thru: parseInt(p.thru) || 0,
            position: p.position?.displayName || p.pos || ''
          })).filter(p => p.name);

          if (players.length > 0) {
            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ source: 'espn-scrape-2', event_name: 'Masters Tournament 2026', last_updated: new Date().toISOString(), players })
            };
          }
        } catch(e) {}
      }
    }
  } catch(e) {}

  // Fallback: Data Golf in-play
  try {
    const r = await fetch(`https://feeds.datagolf.com/preds/in-play?tour=pga&file_format=json&key=${key}`);
    if (r.ok) {
      const d = await r.json();
      const players = (d.live_stats || []).map(p => ({
        name: p.player_name,
        today: p.today || 0,
        total: p.total || 0,
        thru: p.thru || 0,
        position: p.position || ''
      }));
      if (players.length > 0) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ source: 'datagolf-inplay', event_name: d.event_name || 'Masters 2026', last_updated: new Date().toISOString(), players })
        };
      }
    }
  } catch(e) {}

  // Fallback: Data Golf live stats
  try {
    const r = await fetch(`https://feeds.datagolf.com/preds/live-tournament-stats?stats=sg_total&round=${round}&display=value&file_format=json&key=${key}`);
    if (r.ok) {
      const d = await r.json();
      const players = (d.live_stats || []).map(p => ({
        name: p.player_name,
        today: p.today || 0,
        total: p.total || 0,
        thru: p.thru || 0,
        position: p.position || ''
      }));
      if (players.length > 0) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ source: 'datagolf-stats', event_name: d.event_name || 'Masters 2026', last_updated: new Date().toISOString(), players })
        };
      }
    }
  } catch(e) {}

  return {
    statusCode: 503,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'All sources failed — Augusta controls their own data tightly. Try manual entry.', players: [] })
  };
};
