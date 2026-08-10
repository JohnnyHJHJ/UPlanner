import { query } from '../lib/db.js';
import { getSession } from '../lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const session = getSession(req);
    const currentUserId = session?.userId || null;

    const users = await query(`
      SELECT id, username, username_normalized, full_name, birthday,
             degree_program, year_level, section, pronouns, school,
             profile_color, profile_emoji, created_at, updated_at
      FROM users
      ORDER BY username_normalized
    `);

    // Public schedules are visible to everyone. The authenticated user's
    // private schedules are also returned to their owner.
    const schedules = await query(`
      SELECT id, user_id, name, visibility, created_at, updated_at
      FROM schedules
      WHERE visibility = 'public' OR user_id = $1
      ORDER BY name
    `, [currentUserId]);

    const scheduleIds = schedules.rows.map(r => r.id);
    let entries = { rows: [] };
    if (scheduleIds.length) {
      entries = await query(`
        SELECT e.id, e.schedule_id, e.subject, e.day,
               e.start_time::text, e.end_time::text,
               e.created_at, e.updated_at,
               s.user_id, s.name AS schedule_name
        FROM schedule_entries e
        JOIN schedules s ON s.id = e.schedule_id
        WHERE e.schedule_id = ANY($1::text[])
        ORDER BY e.schedule_id, e.day, e.start_time
      `, [scheduleIds]);
    }

    let groups = { rows: [] }, members = { rows: [] }, preferences = { rows: [] };
    if (currentUserId) {
      groups = await query(`
        SELECT id, owner_id, name, created_at, updated_at
        FROM groups WHERE owner_id = $1 ORDER BY name
      `, [currentUserId]);

      members = await query(`
        SELECT gm.id, gm.group_id, gm.user_id, gm.created_at
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE g.owner_id = $1
      `, [currentUserId]);

      preferences = await query(`
        SELECT id, user_id, target_user_id, preference_type, created_at
        FROM user_preferences WHERE user_id = $1
      `, [currentUserId]);
    }

    const records = [];

    for (const u of users.rows) records.push({
      type: 'user', username: u.username, username_normalized: u.username_normalized,
      user_id: u.id, schedule_id: '', name: '', subject: '', day: '', start_time: '', end_time: '',
      visibility: '', created_at: u.created_at, updated_at: u.updated_at,
      full_name: u.full_name || '', birthday: u.birthday || '',
      degree_program: u.degree_program || '', year_level: u.year_level || '', section: u.section || '',
      pronouns: u.pronouns || '', school: u.school || '', group_id: '', target_user_id: '',
      preference_type: '', profile_color: u.profile_color || '#fca5a5', profile_emoji: u.profile_emoji || '😊'
    });

    for (const s of schedules.rows) records.push({
      type: 'schedule', username: '', username_normalized: '', user_id: s.user_id,
      schedule_id: s.id, name: s.name, subject: '', day: '', start_time: '', end_time: '',
      visibility: s.visibility, created_at: s.created_at, updated_at: s.updated_at,
      full_name: '', birthday: '', degree_program: '', year_level: '', section: '', pronouns: '', school: '',
      group_id: '', target_user_id: '', preference_type: '', profile_color: '', profile_emoji: ''
    });

    for (const e of entries.rows) records.push({
      type: 'entry', username: '', username_normalized: '', user_id: e.user_id,
      schedule_id: e.schedule_id, name: e.schedule_name || '', subject: e.subject, day: e.day,
      start_time: e.start_time, end_time: e.end_time, visibility: '',
      created_at: e.created_at, updated_at: e.updated_at,
      full_name: '', birthday: '', degree_program: '', year_level: '', section: '', pronouns: '', school: '',
      group_id: '', target_user_id: '', preference_type: '', profile_color: '', profile_emoji: ''
    });

    for (const g of groups.rows) records.push({
      type: 'group', username: '', username_normalized: '', user_id: g.owner_id,
      schedule_id: '', name: g.name, subject: '', day: '', start_time: '', end_time: '', visibility: '',
      created_at: g.created_at, updated_at: g.updated_at,
      full_name: '', birthday: '', degree_program: '', year_level: '', section: '', pronouns: '', school: '',
      group_id: g.id, target_user_id: '', preference_type: '', profile_color: '', profile_emoji: ''
    });

    for (const m of members.rows) records.push({
      type: 'group_member', username: '', username_normalized: '', user_id: m.user_id,
      schedule_id: '', name: '', subject: '', day: '', start_time: '', end_time: '', visibility: '',
      created_at: m.created_at, updated_at: m.created_at,
      full_name: '', birthday: '', degree_program: '', year_level: '', section: '', pronouns: '', school: '',
      group_id: m.group_id, target_user_id: m.user_id, preference_type: '', profile_color: '', profile_emoji: ''
    });

    // For group_member records the legacy frontend expects target_user_id to
    // identify the member. Preserve that while using the authenticated user's
    // ownership context from the group query.
    for (const m of members.rows) {
      const rec = records.find(r => r.type === 'group_member' && r.group_id === m.group_id && r.target_user_id === m.user_id);
      if (rec) rec.user_id = groups.rows.find(g => g.id === m.group_id)?.owner_id || currentUserId;
    }

    for (const p of preferences.rows) records.push({
      type: 'user_preference', username: '', username_normalized: '', user_id: p.user_id,
      schedule_id: '', name: '', subject: '', day: '', start_time: '', end_time: '', visibility: '',
      created_at: p.created_at, updated_at: p.created_at,
      full_name: '', birthday: '', degree_program: '', year_level: '', section: '', pronouns: '', school: '',
      group_id: '', target_user_id: p.target_user_id || '', preference_type: p.preference_type,
      profile_color: '', profile_emoji: ''
    });

    return res.status(200).json({ session, records });
  } catch (error) {
    console.error('[bootstrap]', error);
    return res.status(500).json({ error: 'Failed to load UPlanner data.' });
  }
}
