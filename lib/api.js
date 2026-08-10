export function method(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed);
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}

export function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body);
}
