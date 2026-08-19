import { query } from '../lib/db.js';
import { method } from '../lib/api.js';

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;

  try {
    const requestedUsername = String(req.body?.username || '').trim();
    if (!requestedUsername) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const normalized = requestedUsername.toLowerCase();
    const result = await query(
      `SELECT username FROM users
       WHERE username_normalized = $1
          OR username_normalized LIKE $2
       ORDER BY username_normalized`,
      [normalized, `${normalized}%`]
    );

    const used = new Set(result.rows.map(row => String(row.username).toLowerCase()));
    let loginUsername = requestedUsername;

    if (used.has(normalized)) {
      let suffix = 1;
      while (used.has(`${normalized}${suffix}`)) suffix += 1;
      loginUsername = `${requestedUsername}${suffix}`;
    }

    return res.status(200).json({
      requested_username: requestedUsername,
      login_username: loginUsername,
      duplicate: loginUsername.toLowerCase() !== normalized
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not check username.' });
  }
}
