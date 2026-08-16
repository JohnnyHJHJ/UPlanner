import { query } from '../../lib/db.js';
import { getSession } from '../../lib/session.js';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[.,'"`’]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const session = getSession(req);

  if (!session) {
    return res.status(401).json({
      error: 'Not authenticated.'
    });
  }

  const userId =
    req.body?.user_id || session.userId;

  // Users may only normalize their own profile
  // through this endpoint.
  if (userId !== session.userId) {
    return res.status(403).json({
      error: 'You can only normalize your own profile.'
    });
  }

  try {
    const result = await query(`
      SELECT
        id,
        school,
        degree_program
      FROM users
      WHERE id = $1
      LIMIT 1
    `, [userId]);

    if (!result.rows.length) {
      return res.status(404).json({
        error: 'User not found.'
      });
    }

    const user = result.rows[0];

    /*
     * SCHOOL
     */
    const schoolNormalized =
      normalizeText(user.school);

    if (schoolNormalized) {
      const schoolAlias = await query(`
        SELECT school_tag_id
        FROM school_aliases
        WHERE alias_normalized = $1
        LIMIT 1
      `, [schoolNormalized]);

      if (schoolAlias.rows.length) {
        await query(`
          INSERT INTO user_school_tags (
            user_id,
            school_tag_id,
            source,
            confidence
          )
          VALUES ($1,$2,'alias',1.000)
          ON CONFLICT (
            user_id,
            school_tag_id
          )
          DO UPDATE SET
            source = EXCLUDED.source,
            confidence = EXCLUDED.confidence
        `, [
          user.id,
          schoolAlias.rows[0].school_tag_id
        ]);
      }
    }

    /*
     * DEGREE
     */
    const degreeNormalized =
      normalizeText(user.degree_program);

    if (degreeNormalized) {
      const degreeAlias = await query(`
        SELECT degree_tag_id
        FROM degree_aliases
        WHERE alias_normalized = $1
        LIMIT 1
      `, [degreeNormalized]);

      if (degreeAlias.rows.length) {
        await query(`
          INSERT INTO user_degree_tags (
            user_id,
            degree_tag_id,
            source,
            confidence
          )
          VALUES ($1,$2,'alias',1.000)
          ON CONFLICT (
            user_id,
            degree_tag_id
          )
          DO UPDATE SET
            source = EXCLUDED.source,
            confidence = EXCLUDED.confidence
        `, [
          user.id,
          degreeAlias.rows[0].degree_tag_id
        ]);
      }
    }

    return res.status(200).json({
      ok: true,
      user_id: user.id
    });

  } catch (error) {
    console.error('[normalize-user]', error);

    return res.status(500).json({
      error: 'Failed to normalize profile.'
    });
  }
}
