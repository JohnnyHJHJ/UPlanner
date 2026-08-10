import { query } from '../lib/db.js';
import { setSession, clearSession } from '../lib/session.js';
import { method } from '../lib/api.js';

export default async function handler(req, res) {
  if (!method(req, res, ['POST', 'DELETE'])) return;

  try {
    if (req.method === 'DELETE') {
      clearSession(res);
      return res.status(204).end();
    }

    const action = req.body?.action;
    const username = String(req.body?.username || '').trim();
    if (!username) return res.status(400).json({ error: 'Username is required.' });

    const normalized = username.toLowerCase();

    if (action === 'signup') {
      const existing = await query(
        'SELECT id, username FROM users WHERE username_normalized = $1 LIMIT 1',
        [normalized]
      );
      if (existing.rows.length) return res.status(409).json({ error: 'That username is already taken.' });

      const id = cryptoRandomId();
      await query(
        `INSERT INTO users (id, username, username_normalized)
         VALUES ($1, $2, $3)`,
        [id, username, normalized]
      );
      setSession(res, id, username);
      return res.status(201).json({ user: { id, username } });
    }

    if (action === 'login') {
      const result = await query(
        'SELECT id, username FROM users WHERE username_normalized = $1 LIMIT 1',
        [normalized]
      );
      if (!result.rows.length) return res.status(401).json({ error: 'Username not found.' });
      const user = result.rows[0];
      setSession(res, user.id, user.username);
      return res.status(200).json({ user });
    }

    return res.status(400).json({ error: 'Unknown auth action.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Authentication failed.' });
  }
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
