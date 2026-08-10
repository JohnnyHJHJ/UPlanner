import { query } from '../lib/db.js';
import { getSession } from '../lib/session.js';

function auth(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated.' });
    return null;
  }
  return session;
}

function cleanRecord(record = {}) {
  return {
    ...record,
    username: String(record.username || '').trim(),
    username_normalized: String(record.username_normalized || record.username || '').trim().toLowerCase()
  };
}

export default async function handler(req, res) {
  if (!['POST','PATCH','DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = auth(req, res);
  if (!session) return;

  const record = cleanRecord(req.body?.record);
  if (!record.type) return res.status(400).json({ error: 'Record type is required.' });

  try {
    if (req.method === 'POST') return await create(record, session, res);
    if (req.method === 'PATCH') return await update(record, session, res);
    return await remove(record, session, res);
  } catch (error) {
    console.error('[data]', error);
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === '23505') return res.status(409).json({ error: 'A duplicate record already exists.' });
    return res.status(500).json({ error: 'Database operation failed.' });
  }
}

async function create(r, session, res) {
  if (r.type === 'user') {
    if (r.user_id !== session.userId) return res.status(403).json({ error: 'Cannot create another user.' });
    const result = await query(`
      INSERT INTO users (id, username, username_normalized, full_name, birthday,
        degree_program, year_level, section, pronouns, school, profile_color, profile_emoji)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [r.user_id, r.username, r.username_normalized, r.full_name || null, r.birthday || null,
        r.degree_program || null, r.year_level || null, r.section || null, r.pronouns || null,
        r.school || null, r.profile_color || '#fca5a5', r.profile_emoji || '😊']);
    return res.status(201).json({ record: userRecord(result.rows[0]) });
  }

  if (r.type === 'schedule') {
    if (r.user_id !== session.userId) return res.status(403).json({ error: 'You do not own this schedule.' });
    const result = await query(`INSERT INTO schedules (id,user_id,name,visibility) VALUES ($1,$2,$3,$4) RETURNING *`,
      [r.schedule_id, session.userId, r.name || session.username, r.visibility || 'public']);
    return res.status(201).json({ record: scheduleRecord(result.rows[0]) });
  }

  if (r.type === 'entry') {
    await assertScheduleOwner(r.schedule_id, session.userId);
    const result = await query(`
      INSERT INTO schedule_entries (id,schedule_id,subject,day,start_time,end_time)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [r.id || crypto.randomUUID(), r.schedule_id, r.subject, r.day, r.start_time, r.end_time]);
    return res.status(201).json({ record: await entryRecord(result.rows[0]) });
  }

  if (r.type === 'group') {
    if (r.user_id !== session.userId) return res.status(403).json({ error: 'You do not own this group.' });
    const result = await query(`INSERT INTO groups (id,owner_id,name) VALUES ($1,$2,$3) RETURNING *`,
      [r.group_id, session.userId, r.name]);
    return res.status(201).json({ record: groupRecord(result.rows[0]) });
  }

  if (r.type === 'group_member') {
    await assertGroupOwner(r.group_id, session.userId);
    const result = await query(`
      INSERT INTO group_members (id,group_id,user_id) VALUES ($1,$2,$3) RETURNING *
    `, [r.id || crypto.randomUUID(), r.group_id, r.target_user_id]);
    return res.status(201).json({ record: groupMemberRecord(result.rows[0], session.userId) });
  }

  if (r.type === 'user_preference') {
    if (r.user_id !== session.userId) return res.status(403).json({ error: 'Invalid preference owner.' });
    const result = await query(`
      INSERT INTO user_preferences (id,user_id,target_user_id,preference_type)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [r.id || crypto.randomUUID(), session.userId, r.target_user_id || null, r.preference_type]);
    return res.status(201).json({ record: preferenceRecord(result.rows[0]) });
  }

  return res.status(400).json({ error: `Unsupported record type: ${r.type}` });
}

async function update(r, session, res) {
  if (r.type === 'user') {
    if (r.user_id !== session.userId) return res.status(403).json({ error: 'You do not own this profile.' });
    const result = await query(`
      UPDATE users SET username=$1, username_normalized=$2, full_name=$3, birthday=$4,
        degree_program=$5, year_level=$6, section=$7, pronouns=$8, school=$9,
        profile_color=$10, profile_emoji=$11, updated_at=NOW()
      WHERE id=$12 RETURNING *
    `, [r.username, r.username_normalized, r.full_name || null, r.birthday || null,
        r.degree_program || null, r.year_level || null, r.section || null, r.pronouns || null,
        r.school || null, r.profile_color || '#fca5a5', r.profile_emoji || '😊', r.user_id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });
    return res.status(200).json({ record: userRecord(result.rows[0]) });
  }

  if (r.type === 'schedule') {
    await assertScheduleOwner(r.schedule_id, session.userId);
    const result = await query(`UPDATE schedules SET name=$1, visibility=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [r.name, r.visibility || 'public', r.schedule_id]);
    return res.status(200).json({ record: scheduleRecord(result.rows[0]) });
  }

  if (r.type === 'entry') {
    await assertScheduleOwner(r.schedule_id, session.userId);
    // Legacy entry records have no stable application id, so use their natural key.
    const old = await query(`SELECT id FROM schedule_entries WHERE schedule_id=$1 AND subject=$2 AND day=$3 AND start_time=$4 AND end_time=$5 LIMIT 1`,
      [r.schedule_id,r.subject,r.day,r.start_time,r.end_time]);
    if (!old.rows.length) return res.status(404).json({ error: 'Entry not found.' });
    const result = await query(`UPDATE schedule_entries SET subject=$1, day=$2, start_time=$3, end_time=$4, updated_at=NOW() WHERE id=$5 RETURNING *`,
      [r.subject,r.day,r.start_time,r.end_time,old.rows[0].id]);
    return res.status(200).json({ record: await entryRecord(result.rows[0]) });
  }

  if (r.type === 'group') {
    await assertGroupOwner(r.group_id, session.userId);
    const result = await query(`UPDATE groups SET name=$1, updated_at=NOW() WHERE id=$2 RETURNING *`, [r.name,r.group_id]);
    return res.status(200).json({ record: groupRecord(result.rows[0]) });
  }

  return res.status(400).json({ error: `Updates are not supported for ${r.type}.` });
}

async function remove(r, session, res) {
  if (r.type === 'user') {
    if (r.user_id !== session.userId) return res.status(403).json({ error: 'You do not own this profile.' });
    await query('DELETE FROM users WHERE id=$1', [session.userId]);
    return res.status(204).end();
  }

  if (r.type === 'schedule') {
    await assertScheduleOwner(r.schedule_id, session.userId);
    await query('DELETE FROM schedules WHERE id=$1', [r.schedule_id]);
    return res.status(204).end();
  }

  if (r.type === 'entry') {
    await assertScheduleOwner(r.schedule_id, session.userId);
    await query(`DELETE FROM schedule_entries WHERE schedule_id=$1 AND subject=$2 AND day=$3 AND start_time=$4 AND end_time=$5`,
      [r.schedule_id,r.subject,r.day,r.start_time,r.end_time]);
    return res.status(204).end();
  }

  if (r.type === 'group') {
    await assertGroupOwner(r.group_id, session.userId);
    await query('DELETE FROM groups WHERE id=$1', [r.group_id]);
    return res.status(204).end();
  }

  if (r.type === 'group_member') {
    await assertGroupOwner(r.group_id, session.userId);
    await query('DELETE FROM group_members WHERE group_id=$1 AND user_id=$2', [r.group_id,r.target_user_id]);
    return res.status(204).end();
  }

  if (r.type === 'user_preference') {
    if (r.user_id !== session.userId) return res.status(403).json({ error: 'Invalid preference owner.' });
    await query('DELETE FROM user_preferences WHERE user_id=$1 AND target_user_id=$2 AND preference_type=$3',
      [session.userId,r.target_user_id || null,r.preference_type]);
    return res.status(204).end();
  }

  return res.status(400).json({ error: `Unsupported record type: ${r.type}` });
}

async function assertScheduleOwner(scheduleId, userId) {
  const result = await query('SELECT user_id FROM schedules WHERE id=$1', [scheduleId]);
  if (!result.rows.length || result.rows[0].user_id !== userId) throw Object.assign(new Error('You do not own this schedule.'), { statusCode:403 });
}

async function assertGroupOwner(groupId, userId) {
  const result = await query('SELECT owner_id FROM groups WHERE id=$1', [groupId]);
  if (!result.rows.length || result.rows[0].owner_id !== userId) throw Object.assign(new Error('You do not own this group.'), { statusCode:403 });
}

function userRecord(u) {
  return { type:'user', username:u.username, username_normalized:u.username_normalized, user_id:u.id,
    schedule_id:'',name:'',subject:'',day:'',start_time:'',end_time:'',visibility:'',created_at:u.created_at,updated_at:u.updated_at,
    full_name:u.full_name||'',birthday:u.birthday||'',degree_program:u.degree_program||'',year_level:u.year_level||'',section:u.section||'',pronouns:u.pronouns||'',school:u.school||'',group_id:'',target_user_id:'',preference_type:'',profile_color:u.profile_color||'#fca5a5',profile_emoji:u.profile_emoji||'😊' };
}
function scheduleRecord(s) {
  return { type:'schedule',username:'',username_normalized:'',user_id:s.user_id,schedule_id:s.id,name:s.name,subject:'',day:'',start_time:'',end_time:'',visibility:s.visibility,created_at:s.created_at,updated_at:s.updated_at,full_name:'',birthday:'',degree_program:'',year_level:'',section:'',pronouns:'',school:'',group_id:'',target_user_id:'',preference_type:'',profile_color:'',profile_emoji:'' };
}
async function entryRecord(e) {
  const s = await query('SELECT user_id,name FROM schedules WHERE id=$1',[e.schedule_id]);
  return { type:'entry',username:'',username_normalized:'',user_id:s.rows[0]?.user_id||'',schedule_id:e.schedule_id,name:s.rows[0]?.name||'',subject:e.subject,day:e.day,start_time:e.start_time,end_time:e.end_time,visibility:'',created_at:e.created_at,updated_at:e.updated_at,full_name:'',birthday:'',degree_program:'',year_level:'',section:'',pronouns:'',school:'',group_id:'',target_user_id:'',preference_type:'',profile_color:'',profile_emoji:'' };
}
function groupRecord(g) {
  return { type:'group',username:'',username_normalized:'',user_id:g.owner_id,schedule_id:'',name:g.name,subject:'',day:'',start_time:'',end_time:'',visibility:'',created_at:g.created_at,updated_at:g.updated_at,full_name:'',birthday:'',degree_program:'',year_level:'',section:'',pronouns:'',school:'',group_id:g.id,target_user_id:'',preference_type:'',profile_color:'',profile_emoji:'' };
}
function groupMemberRecord(m, ownerId) {
  return { type:'group_member',username:'',username_normalized:'',user_id:ownerId,schedule_id:'',name:'',subject:'',day:'',start_time:'',end_time:'',visibility:'',created_at:m.created_at,updated_at:m.created_at,full_name:'',birthday:'',degree_program:'',year_level:'',section:'',pronouns:'',school:'',group_id:m.group_id,target_user_id:m.user_id,preference_type:'',profile_color:'',profile_emoji:'' };
}
function preferenceRecord(p) {
  return { type:'user_preference',username:'',username_normalized:'',user_id:p.user_id,schedule_id:'',name:'',subject:'',day:'',start_time:'',end_time:'',visibility:'',created_at:p.created_at,updated_at:p.created_at,full_name:'',birthday:'',degree_program:'',year_level:'',section:'',pronouns:'',school:'',group_id:'',target_user_id:p.target_user_id||'',preference_type:p.preference_type,profile_color:'',profile_emoji:'' };
}
