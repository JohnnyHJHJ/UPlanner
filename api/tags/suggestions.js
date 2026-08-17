import { query } from '../../lib/db.js';
import { getSession } from '../../lib/session.js';
import { normalizeText } from '../../lib/tags.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!getSession(req)) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

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
          JOIN ${aliasTable} a
            ON a.${tagId} = t.id
          WHERE
            a.alias_normalized LIKE $2
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
    console.error('[tags/suggestions]', error);
    return res.status(500).json({ error: 'Failed to load tag suggestions.' });
  }
}
