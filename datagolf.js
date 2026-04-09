exports.handler = async function(event) {
  const round = event.queryStringParameters?.round || '3';
  const key = 'f5d9837e828cc18f400eb5f24bb0';

  const attempts = [
    // ESPN golf scoreboard — works for Masters
    {
      label: 'espn-golf',
      url: 'https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga'
    },
    // ESPN alternative endpoint
    {
      label: 'espn-golf-2',
      url: 'https://golf-leaderboard-data.p.rapidapi.com/leaderboard/1'
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

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) continue;
      const raw = await response.json();

      let players = [];
      let eventName = 'Masters Tournament 2026';

      if (attempt.label === 'espn-golf' || attempt.label === 'espn-golf-2') {
        // ESPN format — find the Masters event
        const events = raw.events || [];
        const masters = events.find(e =>
          e.name?.toLowerCase().includes('master') ||
          e.shortName?.toLowerCase().includes('master')
        ) || events[0];

        if (!masters) continue;
        eventName = masters.name || eventName;

        const comp = masters.competitions?.[0];
        const competitors = comp?.competitors || [];
        if (!competitors.length) continue;

        players = competitors.map(c => {
          const name = c.athlete?.displayName || c.athlete?.fullName || '';
          // Get today's round score
          const score = parseInt(c.score) || 0;
          const thru = parseInt(c.status?.thru) || 0;
          return {
            name,
            today: score,
            total: parseInt(c.statistics?.find(s => s.name === 'total')?.displayValue) || score,
            thru,
            position: c.status?.position?.displayName || c.status?.position?.id || ''
          };
        }).filter(p => p.name);

      } else if (attempt.label === 'datagolf-inplay' || attempt.label === 'datagolf-stats') {
        eventName = raw.event_name || eventName;
        const stats = raw.live_stats || [];
        if (!stats.length) continue;
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
          body: JSON.stringify({
            source: attempt.label,
            event_name: eventName,
            last_updated: new Date().toISOString(),
            players
          })
        };
      }
    } catch (err) {
      continue;
    }
  }

  return {
    statusCode: 503,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      error: 'No live scoring data available. All sources failed.',
      players: [],
      tried: attempts.map(a => a.label)
    })
  };
};
