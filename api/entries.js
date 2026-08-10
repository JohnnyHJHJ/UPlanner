import { query } from '../lib/db.js';
import { getSession } from '../lib/session.js';
import { method } from '../lib/api.js';

export default async function handler(req, res) {
  if (!method(req, res, ['POST', 'DELETE'])) return;
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const b = req.body || {};

    if (req.method === 'POST') {
      const owner = await query(`
        SELECT user_id FROM schedules WHERE id = $1
      `, [b.schedule_id]);
      if (!owner.rows.length || owner.rows[0].user_id !== session.userId) {
        return res.status(403).json({ error: 'You do not own this schedule.' });
      }

      const result = await query(`
        INSERT INTO schedule_entries
          (id, schedule_id, subject, day, start_time, end_time)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (schedule_id, subject, day, start_time, end_time)
        DO NOTHING
        RETURNING *
      `, [
        b.id || crypto.randomUUID(),
        b.schedule_id, b.subject, b.day, b.start_time, b.end_time
      ]);
      return res.status(201).json({ entry: result.rows[0] || null });
    }

    const owner = await query(`
      SELECT s.user_id
      FROM schedule_entries e JOIN schedules s ON s.id = e.schedule_id
      WHERE e.id = $1
    `, [b.id]);
    if (!owner.rows.length || owner.rows[0].user_id !== session.userId) {
      return res.status(403).json({ error: 'You do not own this entry.' });
    }

    await query('DELETE FROM schedule_entries WHERE id = $1', [b.id]);
    return res.status(204).end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Entry operation failed.' });
  }
}
