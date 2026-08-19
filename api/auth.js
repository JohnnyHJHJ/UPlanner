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
    const requestedUsername = String(req.body?.username || '').trim();
    if (!requestedUsername) return res.status(400).json({ error: 'Username is required.' });

    const normalized = requestedUsername.toLowerCase();

    if (action === 'signup') {
      // The first "luke" keeps "luke"; later signups become
      // "luke1", "luke2", "luke3", etc.
      let username = requestedUsername;
      let usernameNormalized = normalized;
      let suffix = 1;

      while (true) {
        const existing = await query(
          'SELECT id FROM users WHERE username_normalized = $1 LIMIT 1',
          [usernameNormalized]
        );

        if (!existing.rows.length) break;

        username = `${requestedUsername}${suffix}`;
        usernameNormalized = username.toLowerCase();
        suffix += 1;
      }

      const id = cryptoRandomId();
      await query(
        `INSERT INTO users (id, username, username_normalized)
         VALUES ($1, $2, $3)`,
        [id, username, usernameNormalized]
      );
      setSession(res, id, username);
      return res.status(201).json({
        user: { id, username },
        requested_username: requestedUsername,
        tag: `#${username}`
      });
    }

    if (action === 'login') {
      const result = await query(
        'SELECT id, username FROM users WHERE username_normalized = $1 LIMIT 1',
        [normalized]
      );
      if (!result.rows.length) return res.status(401).json({ error: 'Username not found.' });
      const user = result.rows[0];
      setSession(res, user.id, user.username);
      return res.status(200).json({ user, tag: `#${user.username}` });
    }

    return res.status(400).json({ error: 'Unknown auth action.' });
  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'That username is already taken. Please try again.' });
    }
    return res.status(500).json({ error: 'Authentication failed.' });
  }
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
