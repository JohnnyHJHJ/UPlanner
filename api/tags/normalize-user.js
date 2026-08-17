import { getSession } from '../../lib/session.js';
import { syncUserTags } from '../../lib/tags.js';

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

  const userId =
    req.body?.user_id || session.userId;

  // Users may only normalize their own profile
  // through this endpoint.
  if (userId !== session.userId) {
    return res.status(403).json({
      error: 'You can only normalize your own profile.'
    });
  }

  try {
    const result = await syncUserTags(userId);

    if (!result) {
      return res.status(404).json({
        error: 'User not found.'
      });
    }

    return res.status(200).json({
      ok: true,
      user_id: result.userId,
      school_matched: result.schoolMatched,
      degree_matched: result.degreeMatched
    });

  } catch (error) {
    console.error('[normalize-user]', error);

    return res.status(500).json({
      error: 'Failed to normalize profile.'
    });
  }
}