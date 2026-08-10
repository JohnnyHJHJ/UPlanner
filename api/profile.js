import { query } from '../lib/db.js';
import { getSession } from '../lib/session.js';
import { method } from '../lib/api.js';

export default async function handler(req, res) {
  if (!method(req, res, ['PATCH', 'DELETE'])) return;

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    if (req.method === 'DELETE') {
      await query('DELETE FROM users WHERE id = $1', [session.userId]);
      return res.status(204).end();
    }

    const b = req.body || {};
    const result = await query(`
      UPDATE users SET
        username = COALESCE($1, username),
        username_normalized = COALESCE($2, username_normalized),
        full_name = $3,
        birthday = $4,
        school = $5,
        degree_program = $6,
        year_level = $7,
        section = $8,
        pronouns = $9,
        profile_color = $10,
        profile_emoji = $11,
        updated_at = NOW()
      WHERE id = $12
      RETURNING id, username, username_normalized, full_name, birthday,
                school, degree_program, year_level, section, pronouns,
                profile_color, profile_emoji, created_at, updated_at
    `, [
      b.username ?? null,
      b.username ? String(b.username).trim().toLowerCase() : null,
      b.full_name || null,
      b.birthday || null,
      b.school || null,
      b.degree_program || null,
      b.year_level || null,
      b.section || null,
      b.pronouns || null,
      b.profile_color || '#fca5a5',
      b.profile_emoji || '😊',
      session.userId
    ]);

    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });
    const user = result.rows[0];

    if (user.birthday instanceof Date && !Number.isNaN(user.birthday.getTime())) {
      user.birthday = user.birthday.toISOString().slice(0, 10);
    } else if (user.birthday) {
      user.birthday = String(user.birthday).slice(0, 10);
    } else {
      user.birthday = '';
    }
    
    return res.status(200).json({ user });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Username already taken.' });
    console.error(error);
    return res.status(500).json({ error: 'Profile update failed.' });
  }
}
