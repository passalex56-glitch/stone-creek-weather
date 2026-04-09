exports.handler = async function(event) {
  const round = event.queryStringParameters?.round || '3';
  const key = 'f5d9837e828cc18f400eb5f24bb0';

  const attempts = [
    // ESPN Masters 2026 — direct tournament ID
    {
      label: 'espn-masters',
      url: 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard/401811941'
    },
    // ESPN scoreboard generic
    {
      label: 'espn-scoreboard',
      url: 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'
    },
    // Data Golf in-play
    {
      label: 'datagolf-inplay',
      url: `https://feeds.datagolf.com/preds/in-play?tour=pga&file_format=json&key=${key}`
    },
    // Data Golf live stats
    {
      label: 'datagolf-stats',
      url: `https://feeds.datagolf.com/preds/live-tournament-stats?stats=sg_total&round=${round}&display=value&file_format=json&key=${key}`
    }
  ];

  const errors = [];

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
      });

      if (!response.ok) {
        errors.push(`${attempt.label}: HTTP ${response.status}`);
        continue;
      }

      const raw = await response.json();
      let players = [];
      let eventName = 'Masters Tournament 2026';

      if (attempt.label.startsWith('espn')) {
        const events = raw.events || (raw.event ? [raw.event] : []);
        const ev = events[0] || raw;
        eventName = ev.name || ev.fullName || eventName;
        const comp = ev.competitions?.[0] || ev.competition || {};
        const competitors = comp.competitors || ev.competitors || [];

        players = competitors.map(c => {
          const name = c.athlete?.displayName || c.athlete?.fullName || c.displayName || '';
          const todayScore = c.linescores?.find(l => String(l.period) === String(round))?.value;
          const today = todayScore !== undefined ? parseInt(todayScore) : (parseInt(c.score) || 0);
          return {
            name,
            today,
            total: parseInt(c.statistics?.find(s => s.name === 'total' || s.abbreviation === 'TOT')?.displayValue || c.total) || today,
            thru: parseInt(c.status?.thru || c.thru) || 0,
            position: c.status?.position?.displayName || c.status?.type?.shortDetail || ''
          };
        }).filter(p => p.name);

      } else if (attempt.label.startsWith('datagolf')) {
        eventName = raw.event_name || eventName;
        const stats = raw.live_stats || [];
        players = stats.map(p => ({
          name: p.player_name,
          today: p.today || 0,
          total: p.total || 0,
          thru: p.thru || 0,
          position: p.position || ''
        }));
      }

      if (players.length > 0) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ source: attempt.label, event_name: eventName, last_updated: new Date().toISOString(), players })
        };
      } else {
        errors.push(`${attempt.label}: 0 players parsed`);
      }
    } catch (err) {
      errors.push(`${attempt.label}: ${err.message}`);
    }
  }

  return {
    statusCode: 503,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'All sources failed', errors, players: [] })
  };
};
