import { query } from '../lib/db.js';
import { getSession } from '../lib/session.js';
import { method } from '../lib/api.js';

export default async function handler(req, res) {
  if (req.method === 'GET' && req.query?.action === 'stats') {
    return scheduleStats(req, res);
  }

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

async function scheduleStats(req, res) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const result = await query(`
      SELECT
        COUNT(DISTINCT s.id)::int AS schedules,
        COUNT(e.id)::int AS class_count,
        COUNT(DISTINCT e.subject)::int AS subject_count,
        COALESCE(SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 3600), 0)::numeric AS class_hours,
        COUNT(DISTINCT e.day)::int AS class_days,
        MIN(e.start_time) AS earliest_start,
        MAX(e.end_time) AS latest_end
      FROM schedules s
      LEFT JOIN schedule_entries e ON e.schedule_id = s.id
      WHERE s.user_id = $1
    `, [session.userId]);

    const busiest = await query(`
      SELECT e.day,
             COUNT(*)::int AS classes,
             COALESCE(SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 3600), 0)::numeric AS hours
      FROM schedules s
      JOIN schedule_entries e ON e.schedule_id = s.id
      WHERE s.user_id = $1
      GROUP BY e.day
      ORDER BY SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time))) DESC
      LIMIT 1
    `, [session.userId]);

    const stats = result.rows[0];
    return res.status(200).json({
      stats: {
        schedules: Number(stats.schedules || 0),
        class_count: Number(stats.class_count || 0),
        subject_count: Number(stats.subject_count || 0),
        class_hours: Number(stats.class_hours || 0),
        class_days: Number(stats.class_days || 0),
        earliest_start: stats.earliest_start || null,
        latest_end: stats.latest_end || null,
        busiest_day: busiest.rows[0] || null
      }
    });
  } catch (error) {
    console.error('[schedules/stats]', error);
    return res.status(500).json({ error: 'Failed to load schedule statistics.' });
  }
}
