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

function normalizeDegreeForFallback(value) {
  return normalizeText(value)
    .replace(/^(bs|ba|ab|aa|bsc|msc|ms|ma|phd)\s+/, '')
    .trim();
}

/**
 * Re-sync a user's academic tags from their current profile values.
 *
 * Alias matches remain authoritative. If an alias has not yet been added for
 * a degree, fall back to matching the normalized degree name against the
 * canonical tag display name. This lets values such as "BS Business
 * Administration" automatically use the existing Business Administration
 * tag without requiring every common degree prefix to be registered.
 */
export async function syncUserTags(userId) {
  const result = await query(`
    SELECT id, school, degree_program
    FROM users
    WHERE id = $1
    LIMIT 1
  `, [userId]);

  if (!result.rows.length) return null;

  const user = result.rows[0];
  let schoolMatched = false;
  let degreeMatched = false;

  await query(`DELETE FROM user_school_tags WHERE user_id = $1`, [userId]);

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

  await query(`DELETE FROM user_degree_tags WHERE user_id = $1`, [userId]);

  const degreeNormalized = normalizeText(user.degree_program);
  if (degreeNormalized) {
    const degreeAlias = await query(`
      SELECT degree_tag_id
      FROM degree_aliases
      WHERE alias_normalized = $1
      LIMIT 1
    `, [degreeNormalized]);

    let degreeTagId = degreeAlias.rows[0]?.degree_tag_id || null;
    let source = 'alias';

    if (!degreeTagId) {
      const fallback = normalizeDegreeForFallback(user.degree_program);
      if (fallback) {
        const degreeTag = await query(`
          SELECT id
          FROM degree_tags
          WHERE regexp_replace(
            lower(regexp_replace(display_name, '[.,''"`’]', '', 'g')),
            '[-_/]+', ' ', 'g'
          ) = $1
          LIMIT 1
        `, [fallback]);
        if (degreeTag.rows.length) {
          degreeTagId = degreeTag.rows[0].id;
          source = 'name';
        }
      }
    }

    if (degreeTagId) {
      await query(`
        INSERT INTO user_degree_tags (user_id, degree_tag_id, source, confidence)
        VALUES ($1, $2, $3, 1.000)
        ON CONFLICT (user_id, degree_tag_id)
        DO UPDATE SET source = EXCLUDED.source, confidence = EXCLUDED.confidence
      `, [user.id, degreeTagId, source]);
      degreeMatched = true;
    }
  }

  return { userId: user.id, schoolMatched, degreeMatched };
}
