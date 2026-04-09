exports.handler = async function(event) {
  const round = event.queryStringParameters?.round || '1';
  const key = 'f5d9837e828cc18f400eb5f24bb0';
  const url = `https://feeds.datagolf.com/preds/live-tournament-stats?stats=sg_total&round=${round}&display=value&file_format=json&key=${key}`;

  try {
    const response = await fetch(url);
    const body = await response.text();
    
    // Always return 200 so we can see what's happening
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        debug_status: response.status,
        debug_url: url,
        debug_body: body.substring(0, 2000),
        players: []
      })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ debug_error: err.message, debug_url: url, players: [] })
    };
  }
};
