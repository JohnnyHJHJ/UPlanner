import { query } from '../../lib/db.js';
import { getSession } from '../../lib/session.js';

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  const session =
    getSession(req);

  if (!session) {
    return res.status(401).json({
      error: 'Not authenticated.'
    });
  }

  const people =
    Array.isArray(
      req.body?.user_ids
    )
      ? req.body.user_ids
      : [];

  if (!people.length) {
    return res.status(400).json({
      error:
        'No people were selected.'
    });
  }

  try {

    for (
      const targetUserId
      of people
    ) {

      if (
        targetUserId ===
        session.userId
      ) {
        continue;
      }

      /*
       * Only save someone who is
       * currently discoverable.
       */
      const allowed =
        await query(`
          SELECT u.id

          FROM users u

          LEFT JOIN profile_visibility pv
            ON pv.user_id = u.id

          WHERE
            u.id = $1

            AND COALESCE(
              pv.discoverable,
              TRUE
            ) = TRUE

            AND NOT EXISTS (
              SELECT 1
              FROM blocked_users b
              WHERE
                (
                  b.blocker_user_id = $2
                  AND
                  b.blocked_user_id = u.id
                )

                OR

                (
                  b.blocker_user_id = u.id
                  AND
                  b.blocked_user_id = $2
                )
            )

          LIMIT 1
        `, [
          targetUserId,
          session.userId
        ]);

      if (!allowed.rows.length) {
        continue;
      }

      await query(`
        INSERT INTO saved_people (
          user_id,
          target_user_id
        )
        VALUES ($1,$2)

        ON CONFLICT (
          user_id,
          target_user_id
        )
        DO NOTHING
      `, [
        session.userId,
        targetUserId
      ]);
    }

    return res.status(200).json({
      ok: true
    });

  } catch (error) {

    console.error(
      '[people/save]',
      error
    );

    return res.status(500).json({
      error:
        'Failed to save selected people.'
    });
  }
}