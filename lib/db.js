import { sql } from '@vercel/postgres';

export { sql };

export async function query(text, params = []) {
  return sql.query(text, params);
}
