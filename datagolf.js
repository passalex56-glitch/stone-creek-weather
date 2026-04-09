exports.handler = async function(event) {
  const round = event.queryStringParameters?.round || '3';
  const key = 'f5d9837e828cc18f400eb5f24bb0';
  
  // Try the requested round first, fall back to event_cumulative if 404
  const urls = [
    `https://feeds.datagolf.com/preds/live-tournament-stats?stats=sg_total&round=${round}&display=value&file_format=json&key=${key}`,
    `https://feeds.datagolf.com/preds/live-tournament-stats?stats=sg_total&round=event_cumulative&display=value&file_format=json&key=${key}`,
    `https://feeds.datagolf.com/preds/in-play?tour=pga&file_format=json&key=${key}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.text();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-Source-URL': url,
          },
          body: data,
        };
      }
    } catch (err) {
      continue;
    }
  }

  return {
    statusCode: 404,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'No live data available from Data Golf yet. Round may not have started.' }),
  };
};
