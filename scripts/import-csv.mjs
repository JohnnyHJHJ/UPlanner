/*
  One-time migration helper.

  Usage:
    DATABASE_URL="..." node scripts/import-csv.mjs ./uplanner-export.csv

  The CSV has the original Canva columns:
  type, username, username_normalized, user_id, schedule_id, name,
  subject, day, start_time, end_time, visibility, created_at, updated_at,
  full_name, birthday, degree_program, year_level, section, pronouns, school,
  group_id, target_user_id, preference_type, profile_color, profile_emoji

  This script intentionally keeps the original IDs so existing relationships
  continue to work.
*/

import fs from 'node:fs';
import { Client } from 'pg';

const file = process.argv[2];
if (!file) throw new Error('Pass the CSV path.');

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

function parseCSVLine(line) {
  const out = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i], n = line[i + 1];
    if (c === '"' && quoted && n === '"') { cur += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCSVLine(lines.shift()).map(x => x.trim());
  return lines.map(line => {
    const vals = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').trim()]));
  });
}

const rows = parseCSV(fs.readFileSync(file, 'utf8'));

await client.query('BEGIN');
try {
  for (const r of rows) {
    if (r.type === 'user') {
      await client.query(`
        INSERT INTO users
          (id, username, username_normalized, full_name, birthday,
           degree_program, year_level, section, pronouns, school,
           profile_color, profile_emoji, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (id) DO UPDATE SET
          username=EXCLUDED.username,
          username_normalized=EXCLUDED.username_normalized,
          full_name=EXCLUDED.full_name,
          birthday=EXCLUDED.birthday,
          degree_program=EXCLUDED.degree_program,
          year_level=EXCLUDED.year_level,
          section=EXCLUDED.section,
          pronouns=EXCLUDED.pronouns,
          school=EXCLUDED.school,
          profile_color=EXCLUDED.profile_color,
          profile_emoji=EXCLUDED.profile_emoji,
          updated_at=EXCLUDED.updated_at
      `, [
        r.user_id, r.username, r.username_normalized,
        r.full_name || null, r.birthday || null, r.degree_program || null,
        r.year_level || null, r.section || null, r.pronouns || null,
        r.school || null, r.profile_color || '#fca5a5',
        r.profile_emoji || '😊', r.created_at || new Date(), r.updated_at || new Date()
      ]);
    }

    if (r.type === 'schedule') {
      await client.query(`
        INSERT INTO schedules (id,user_id,name,visibility,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET
          user_id=EXCLUDED.user_id,name=EXCLUDED.name,
          visibility=EXCLUDED.visibility,updated_at=EXCLUDED.updated_at
      `, [
        r.schedule_id, r.user_id, r.name || r.username || '',
        r.visibility || 'public', r.created_at || new Date(), r.updated_at || new Date()
      ]);
    }

    if (r.type === 'entry') {
      await client.query(`
        INSERT INTO schedule_entries
          (id,schedule_id,subject,day,start_time,end_time,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (schedule_id,subject,day,start_time,end_time) DO NOTHING
      `, [
        r.id || crypto.randomUUID(), r.schedule_id, r.subject, r.day,
        r.start_time, r.end_time, r.created_at || new Date(), r.updated_at || new Date()
      ]);
    }

    if (r.type === 'group') {
      await client.query(`
        INSERT INTO groups (id,owner_id,name,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET
          owner_id=EXCLUDED.owner_id,name=EXCLUDED.name,updated_at=EXCLUDED.updated_at
      `, [
        r.group_id, r.user_id, r.name, r.created_at || new Date(), r.updated_at || new Date()
      ]);
    }

    if (r.type === 'group_member') {
      await client.query(`
        INSERT INTO group_members (id,group_id,user_id,created_at)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (group_id,user_id) DO NOTHING
      `, [
        r.id || crypto.randomUUID(), r.group_id, r.target_user_id, r.created_at || new Date()
      ]);
    }

    if (r.type === 'user_preference') {
      await client.query(`
        INSERT INTO user_preferences
          (id,user_id,target_user_id,preference_type,created_at)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (user_id,target_user_id,preference_type) DO NOTHING
      `, [
        r.id || crypto.randomUUID(), r.user_id, r.target_user_id,
        r.preference_type, r.created_at || new Date()
      ]);
    }
  }

  await client.query('COMMIT');
  console.log(`Imported ${rows.length} CSV rows.`);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
