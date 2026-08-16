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

  const policyVersion =
    String(req.body?.policy_version || '').trim();

  if (!policyVersion) {
    return res.status(400).json({
      error: 'policy_version is required.'
    });
  }

  try {
    await query(`
      INSERT INTO privacy_acknowledgements (
        user_id,
        policy_version
      )
      VALUES ($1,$2)
      ON CONFLICT (
        user_id,
        policy_version
      )
      DO NOTHING
    `, [
      session.userId,
      policyVersion
    ]);

    await query(`
      INSERT INTO onboarding_state (
        user_id,
        privacy_completed_version,
        updated_at
      )
      VALUES ($1,$2,NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        privacy_completed_version =
          EXCLUDED.privacy_completed_version,
        updated_at = NOW()
    `, [
      session.userId,
      policyVersion
    ]);

    return res.status(200).json({
      ok: true
    });

  } catch (error) {
    console.error('[privacy]', error);

    return res.status(500).json({
      error: 'Failed to save privacy acknowledgment.'
    });
  }
}
