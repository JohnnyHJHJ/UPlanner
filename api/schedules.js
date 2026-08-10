import { query } from '../lib/db.js';
import { getSession } from '../lib/session.js';
import { method } from '../lib/api.js';

export default async function handler(req, res) {
  if (!method(req, res, ['POST', 'PATCH', 'DELETE'])) return;
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const b = req.body || {};

    if (req.method === 'POST') {
      const id = b.id || crypto.randomUUID();
      const result = await query(`
        INSERT INTO schedules (id, user_id, name, visibility)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [id, session.userId, b.name || session.username, b.visibility || 'public']);
      return res.status(201).json({ schedule: result.rows[0] });
    }

    const id = b.id;
    if (!id) return res.status(400).json({ error: 'Schedule id is required.' });

    const owner = await query('SELECT user_id FROM schedules WHERE id = $1', [id]);
    if (!owner.rows.length || owner.rows[0].user_id !== session.userId) {
      return res.status(403).json({ error: 'You do not own this schedule.' });
    }

    if (req.method === 'DELETE') {
      await query('DELETE FROM schedules WHERE id = $1', [id]);
      return res.status(204).end();
    }

    const result = await query(`
      UPDATE schedules SET name = $1, visibility = $2, updated_at = NOW()
      WHERE id = $3 RETURNING *
    `, [b.name, b.visibility || 'public', id]);

    return res.status(200).json({ schedule: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Schedule operation failed.' });
  }
}
