exports.handler = async function(event) {
  const round = event.queryStringParameters?.round || '3';
  const key = 'f5d9837e828cc18f400eb5f24bb0';
  const url = `https://feeds.datagolf.com/preds/live-tournament-stats?stats=sg_total&round=${round}&display=value&file_format=json&key=${key}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: `Data Golf returned HTTP ${response.status}`, players: [] })
      };
    }

    const d = await response.json();
    const players = (d.live_stats || [])
      .filter(p => p.position !== 'WAITING' && p.round !== null)
      .map(p => ({
        name: p.player_name,   // "Burns, Sam"
        today: p.round || 0,   // round score vs par (this is the key field!)
        total: p.total || 0,
        thru: p.thru || 0,
        position: p.position || ''
      }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        source: 'datagolf',
        event_name: d.event_name || 'Masters Tournament',
        last_updated: d.last_updated || new Date().toISOString(),
        stat_round: d.stat_round || round,
        players
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message, players: [] })
    };
  }
};
