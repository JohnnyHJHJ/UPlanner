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
 * Re-sync a user's academic tags from their current profile values.
 *
 * The tag relationship tables are treated as a derived cache of users.school
 * and users.degree_program. Rebuilding the relationships on every sync makes
 * school/degree changes and clearing fields authoritative and idempotent.
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

  // SCHOOL: remove all derived relationships first so changes and clears
  // cannot leave stale tags behind.
  await query(`
    DELETE FROM user_school_tags
    WHERE user_id = $1
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

  // DEGREE: same authoritative rebuild behavior.
  await query(`
    DELETE FROM user_degree_tags
    WHERE user_id = $1
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

  return {
    userId: user.id,
    schoolMatched,
    degreeMatched
  };
}
