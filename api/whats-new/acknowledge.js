import { query } from '../../lib/db.js';
import { getSession } from '../../lib/session.js';

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

  const version =
    String(req.body?.version || '').trim();

  const doNotShowAgain =
    Boolean(req.body?.do_not_show_again);

  if (!version) {
    return res.status(400).json({
      error: 'version is required.'
    });
  }

  try {
    await query(`
      INSERT INTO whats_new_acknowledgements (
        user_id,
        version,
        do_not_show_again
      )
      VALUES ($1,$2,$3)
      ON CONFLICT (
        user_id,
        version
      )
      DO UPDATE SET
        do_not_show_again =
          EXCLUDED.do_not_show_again,
        acknowledged_at = NOW()
    `, [
      session.userId,
      version,
      doNotShowAgain
    ]);

    await query(`
      INSERT INTO onboarding_state (
        user_id,
        whats_new_version,
        updated_at
      )
      VALUES ($1,$2,NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        whats_new_version =
          EXCLUDED.whats_new_version,
        updated_at = NOW()
    `, [
      session.userId,
      version
    ]);

    return res.status(200).json({
      ok: true
    });

  } catch (error) {
    console.error('[whats-new]', error);

    return res.status(500).json({
      error: 'Failed to save preference.'
    });
  }
}