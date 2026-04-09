exports.handler = async function(event) {
  const round = event.queryStringParameters?.round || '3';
  const key = 'f5d9837e828cc18f400eb5f24bb0';

  // Try Data Golf in-play predictions (works for Masters)
  // Then fall back to ESPN public leaderboard
  const attempts = [
    {
      label: 'datagolf-inplay',
      url: `https://feeds.datagolf.com/preds/in-play?tour=pga&file_format=json&key=${key}`
    },
    {
      label: 'datagolf-livestats',
      url: `https://feeds.datagolf.com/preds/live-tournament-stats?stats=sg_total&round=${round}&display=value&file_format=json&key=${key}`
    },
    {
      label: 'espn',
      url: `https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard`
    }
  ];

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url);
      if (response.ok) {
        const raw = await response.json();

        // Normalize to common format: { source, event_name, players: [{name, today, total, thru, position}] }
        let normalized = { source: attempt.label, players: [], event_name: '', last_updated: new Date().toISOString() };

        if (attempt.label === 'datagolf-inplay') {
          normalized.event_name = raw.event_name || 'Masters Tournament';
          normalized.last_updated = raw.last_updated || '';
          normalized.players = (raw.live_stats || []).map(p => ({
            name: p.player_name,       // "Scheffler, Scottie"
            today: p.today || 0,
            total: p.total || 0,
            thru: p.thru || 0,
            position: p.position || ''
          }));
        } else if (attempt.label === 'datagolf-livestats') {
          normalized.event_name = raw.event_name || 'Masters Tournament';
          normalized.last_updated = raw.last_updated || '';
          normalized.players = (raw.live_stats || []).map(p => ({
            name: p.player_name,
            today: p.today || 0,
            total: p.total || 0,
            thru: p.thru || 0,
            position: p.position || ''
          }));
        } else if (attempt.label === 'espn') {
          // ESPN format
          const comp = raw.events?.[0];
          normalized.event_name = comp?.name || 'Masters Tournament';
          const competitors = comp?.competitions?.[0]?.competitors || [];
          normalized.players = competitors.map(c => {
            const today = c.linescores?.find(l => l.period == round)?.value || 0;
            return {
              name: c.athlete?.displayName || '',   // "Scottie Scheffler"
              today: parseInt(today) || 0,
              total: parseInt(c.score) || 0,
              thru: parseInt(c.status?.thru) || 0,
              position: c.status?.position?.displayName || ''
            };
          });
        }

        if (normalized.players.length > 0) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(normalized)
          };
        }
      }
    } catch (err) {
      continue;
    }
  }

  return {
    statusCode: 503,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'No live scoring data available yet. Try again once the round is underway.', players: [] })
  };
};
