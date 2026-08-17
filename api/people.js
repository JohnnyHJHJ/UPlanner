import { query } from '../lib/db.js';
import { getSession } from '../lib/session.js';

export default async function handler(req, res) {
  const session = getSession(req);

  if (!session) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  if (req.method === 'POST') {
    const people = Array.isArray(req.body?.user_ids)
      ? req.body.user_ids
      : [];

    if (!people.length) {
      return res.status(400).json({ error: 'No people were selected.' });
    }

    try {
      for (const targetUserId of people) {
        if (targetUserId === session.userId) continue;

        const allowed = await query(`
          SELECT u.id
          FROM users u
          LEFT JOIN profile_visibility pv ON pv.user_id = u.id
          WHERE u.id = $1
            AND COALESCE(pv.discoverable, TRUE) = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM blocked_users b
              WHERE (b.blocker_user_id = $2 AND b.blocked_user_id = u.id)
                 OR (b.blocker_user_id = u.id AND b.blocked_user_id = $2)
            )
          LIMIT 1
        `, [targetUserId, session.userId]);

        if (!allowed.rows.length) continue;

        await query(`
          INSERT INTO saved_people (user_id, target_user_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, target_user_id) DO NOTHING
        `, [session.userId, targetUserId]);
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('[people/save]', error);
      return res.status(500).json({ error: 'Failed to save selected people.' });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const currentUserId = session.userId;

  try {
    const people = await query(`
      SELECT
        u.id, u.username, u.full_name, u.school, u.degree_program,
        u.year_level, u.section, u.pronouns, u.profile_color, u.profile_emoji,
        pv.discoverable, pv.show_school_tag, pv.show_degree_tag
      FROM users u
      LEFT JOIN profile_visibility pv ON pv.user_id = u.id
      WHERE u.id <> $1
        AND COALESCE(pv.discoverable, TRUE) = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM blocked_users b
          WHERE b.blocker_user_id = $1 AND b.blocked_user_id = u.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM blocked_users b
          WHERE b.blocker_user_id = u.id AND b.blocked_user_id = $1
        )
      ORDER BY u.username_normalized
    `, [currentUserId]);

    const userIds = people.rows.map(person => person.id);
    let schoolTags = { rows: [] };
    let degreeTags = { rows: [] };

    if (userIds.length) {
      schoolTags = await query(`
        SELECT ust.user_id, st.id, st.canonical_name, st.display_name, ust.confidence
        FROM user_school_tags ust
        JOIN school_tags st ON st.id = ust.school_tag_id
        WHERE ust.user_id = ANY($1::text[])
      `, [userIds]);

      degreeTags = await query(`
        SELECT udt.user_id, dt.id, dt.canonical_name, dt.display_name, udt.confidence
        FROM user_degree_tags udt
        JOIN degree_tags dt ON dt.id = udt.degree_tag_id
        WHERE udt.user_id = ANY($1::text[])
      `, [userIds]);
    }

    const result = people.rows.map(user => {
      const school = user.show_school_tag
        ? schoolTags.rows.filter(tag => tag.user_id === user.id).map(tag => ({
            id: tag.id,
            canonical_name: tag.canonical_name,
            display_name: tag.display_name,
            confidence: tag.confidence
          }))
        : [];

      const degree = user.show_degree_tag
        ? degreeTags.rows.filter(tag => tag.user_id === user.id).map(tag => ({
            id: tag.id,
            canonical_name: tag.canonical_name,
            display_name: tag.display_name,
            confidence: tag.confidence
          }))
        : [];

      return {
        user_id: user.id,
        username: user.username,
        full_name: user.full_name || '',
        school: user.school || '',
        degree_program: user.degree_program || '',
        year_level: user.year_level || '',
        section: user.section || '',
        pronouns: user.pronouns || '',
        profile_color: user.profile_color || '#fca5a5',
        profile_emoji: user.profile_emoji || '😊',
        school_tags: school,
        degree_tags: degree
      };
    });

    return res.status(200).json({ people: result });
  } catch (error) {
    console.error('[people]', error);
    return res.status(500).json({ error: 'Failed to load people.' });
  }
}
