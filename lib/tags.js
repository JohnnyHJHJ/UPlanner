import { query } from './db.js';

// Normalizes free-text school/degree values into a comparable form so
// they can be matched against school_aliases.alias_normalized /
// degree_aliases.alias_normalized.
export function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[.,'"`’]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Re-syncs a single user's school/degree tags from their CURRENT
 * users.school / users.degree_program values.
 *
 * Previously auto-assigned ('alias') tags are deleted first, so a changed
 * school/degree doesn't leave stale relationships behind — e.g. changing
 * from "UP Diliman" to "DLSU" must drop the old UP Diliman tag, not just
 * add a DLSU one alongside it.
 *
 * Safe to call repeatedly for the same user (idempotent).
 *
 * Called from:
 *  - POST /api/tags/normalize-user (self-service, single user)
 *  - PATCH /api/data (type: 'user')
 *  - POST /api/data (type: 'user', on creation)
 *  - PATCH /api/profile
 *  - eventually the batch migration, once per user
 */
export async function syncUserTags(userId) {
  const result = await query(`
    SELECT id, school, degree_program
    FROM users
    WHERE id = $1
    LIMIT 1
  `, [userId]);

  if (!result.rows.length) {
    return null;
  }

  const user = result.rows[0];
  let schoolMatched = false;
  let degreeMatched = false;

  // --- SCHOOL ---
  await query(`
    DELETE FROM user_school_tags
    WHERE user_id = $1 AND source = 'alias'
  `, [userId]);

  const schoolNormalized = normalizeText(user.school);
  if (schoolNormalized) {
    const schoolAlias = await query(`
      SELECT school_tag_id
      FROM school_aliases
      WHERE alias_normalized = $1
      LIMIT 1
    `, [schoolNormalized]);

    if (schoolAlias.rows.length) {
      await query(`
        INSERT INTO user_school_tags (user_id, school_tag_id, source, confidence)
        VALUES ($1, $2, 'alias', 1.000)
        ON CONFLICT (user_id, school_tag_id)
        DO UPDATE SET source = EXCLUDED.source, confidence = EXCLUDED.confidence
      `, [user.id, schoolAlias.rows[0].school_tag_id]);
      schoolMatched = true;
    }
  }

  // --- DEGREE ---
  await query(`
    DELETE FROM user_degree_tags
    WHERE user_id = $1 AND source = 'alias'
  `, [userId]);

  const degreeNormalized = normalizeText(user.degree_program);
  if (degreeNormalized) {
    const degreeAlias = await query(`
      SELECT degree_tag_id
      FROM degree_aliases
      WHERE alias_normalized = $1
      LIMIT 1
    `, [degreeNormalized]);

    if (degreeAlias.rows.length) {
      await query(`
        INSERT INTO user_degree_tags (user_id, degree_tag_id, source, confidence)
        VALUES ($1, $2, 'alias', 1.000)
        ON CONFLICT (user_id, degree_tag_id)
        DO UPDATE SET source = EXCLUDED.source, confidence = EXCLUDED.confidence
      `, [user.id, degreeAlias.rows[0].degree_tag_id]);
      degreeMatched = true;
    }
  }

  return { userId: user.id, schoolMatched, degreeMatched };
}