import { query } from '../lib/db.js';
import { getSession } from '../lib/session.js';
import { method } from '../lib/api.js';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;

  try {
    const session = getSession(req);

    const users = await query(`
      SELECT id, username, username_normalized, full_name, birthday,
             degree_program, year_level, section, pronouns, school,
             profile_color, profile_emoji, created_at, updated_at
      FROM users
      ORDER BY username_normalized
    `);

    const schedules = await query(`
      SELECT id, user_id, name, visibility, created_at, updated_at
      FROM schedules
      WHERE visibility = 'public' OR user_id = $1
      ORDER BY name
    `, [session?.userId || null]);

    const scheduleIds = schedules.rows.map(r => r.id);
    let entries = { rows: [] };
    if (scheduleIds.length) {
      entries = await query(`
        SELECT id, schedule_id, subject, day, start_time::text,
               end_time::text, created_at, updated_at
        FROM schedule_entries
        WHERE schedule_id = ANY($1::text[])
        ORDER BY schedule_id, day, start_time
      `, [scheduleIds]);
    }

    let groups = { rows: [] }, members = { rows: [] }, preferences = { rows: [] };
    if (session?.userId) {
      groups = await query(`
        SELECT id, owner_id, name, created_at, updated_at
        FROM groups WHERE owner_id = $1 ORDER BY name
      `, [session.userId]);

      members = await query(`
        SELECT gm.id, gm.group_id, gm.user_id, gm.created_at
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE g.owner_id = $1
      `, [session.userId]);

      preferences = await query(`
        SELECT id, user_id, target_user_id, preference_type, created_at
        FROM user_preferences WHERE user_id = $1
      `, [session.userId]);
    }

    return res.status(200).json({
      session,
      users: users.rows,
      schedules: schedules.rows,
      entries: entries.rows,
      groups: groups.rows,
      group_members: members.rows,
      preferences: preferences.rows
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load UPlanner data.' });
  }
}
