export const onRequest = async () => {
  const upstream = await fetch('https://www.google.com/generate_204', { method: 'HEAD' });
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: 'google_unreachable', status: upstream.status }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' }
    });
  }
  const dateHeader = upstream.headers.get('date');
  if (!dateHeader) {
    return new Response(JSON.stringify({ error: 'missing_date_header' }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' }
    });
  }
  const iso = new Date(dateHeader).toISOString();
  return new Response(JSON.stringify({ iso }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'content-type'
    }
  });
};
