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

  const feature =
    String(req.body?.feature || '').trim();

  const version =
    String(req.body?.version || '').trim();

  if (!feature || !version) {
    return res.status(400).json({
      error: 'feature and version are required.'
    });
  }

  try {
    let column = null;

    if (feature === 'people_discovery') {
      column = 'people_discovery_completed_version';
    } else if (feature === 'visibility_setup') {
      column = 'visibility_setup_completed_version';
    } else {
      return res.status(400).json({
        error: 'Unsupported onboarding feature.'
      });
    }

    await query(`
      INSERT INTO onboarding_state (
        user_id,
        ${column},
        updated_at
      )
      VALUES ($1,$2,NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        ${column} = EXCLUDED.${column},
        updated_at = NOW()
    `, [
      session.userId,
      version
    ]);

    return res.status(200).json({
      ok: true
    });

  } catch (error) {
    console.error('[onboarding]', error);

    return res.status(500).json({
      error: 'Failed to save onboarding state.'
    });
  }
}
