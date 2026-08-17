import { query } from '../lib/db.js';
import { getSession } from '../lib/session.js';
import { method } from '../lib/api.js';
import { syncUserTags, normalizeText } from '../lib/tags.js';

export default async function handler(req, res) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated.' });

  // Keep autocomplete under the existing profile function so Vercel Hobby
  // does not need another Serverless Function.
  if (req.method === 'GET' && req.query?.action === 'suggestions') {
    return suggestions(req, res);
  }

  if (!method(req, res, ['PATCH', 'DELETE'])) return;

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

    await syncUserTags(session.userId);

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

async function suggestions(req, res) {
  const type = String(req.query?.type || '').trim().toLowerCase();
  const rawQuery = String(req.query?.q || '').trim();
  const limit = Math.min(Math.max(Number(req.query?.limit) || 12, 1), 25);
  const normalizedQuery = normalizeText(rawQuery);

  if (!['school', 'degree'].includes(type)) {
    return res.status(400).json({ error: 'type must be school or degree.' });
  }

  try {
    const tagTable = type === 'school' ? 'school_tags' : 'degree_tags';
    const aliasTable = type === 'school' ? 'school_aliases' : 'degree_aliases';
    const tagId = type === 'school' ? 'school_tag_id' : 'degree_tag_id';

    const result = normalizedQuery
      ? await query(`
          SELECT
            t.id,
            t.canonical_name,
            t.display_name,
            MIN(CASE WHEN a.alias_normalized = $1 THEN 0 ELSE 1 END) AS exact_rank
          FROM ${tagTable} t
          JOIN ${aliasTable} a ON a.${tagId} = t.id
          WHERE a.alias_normalized LIKE $2
             OR t.canonical_name LIKE $2
             OR t.display_name ILIKE $3
          GROUP BY t.id, t.canonical_name, t.display_name
          ORDER BY exact_rank, t.display_name
          LIMIT $4
        `, [normalizedQuery, `${normalizedQuery}%`, `%${rawQuery}%`, limit])
      : await query(`
          SELECT id, canonical_name, display_name
          FROM ${tagTable}
          ORDER BY display_name
          LIMIT $1
        `, [limit]);

    return res.status(200).json({
      type,
      suggestions: result.rows.map(row => ({
        id: row.id,
        canonical_name: row.canonical_name,
        display_name: row.display_name
      }))
    });
  } catch (error) {
    console.error('[profile/suggestions]', error);
    return res.status(500).json({ error: 'Failed to load tag suggestions.' });
  }
}
