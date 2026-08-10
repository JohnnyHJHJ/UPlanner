# UPlanner API design

The original Canva `window.dataSdk.init/create/update/delete` layer is removed.

## Auth
- `POST /api/auth` body `{action:"signup", username}`
- `POST /api/auth` body `{action:"login", username}`
- `DELETE /api/auth` logs out

## Data
- `GET /api/bootstrap` returns the public directory, public schedules/entries, and the authenticated user's private groups/preferences.
- `PATCH /api/profile` updates the authenticated user's profile.
- `DELETE /api/profile` deletes the authenticated user's account. PostgreSQL cascades schedules, entries, groups, memberships, and preferences.

## Schedules
- `POST /api/schedules`
- `PATCH /api/schedules`
- `DELETE /api/schedules`

## Entries
- `POST /api/entries`
- `DELETE /api/entries`

Groups and preferences should be implemented as additional protected endpoints following the same ownership checks.

## Important
The original UPlanner uses username-only login. This scaffold preserves that behavior so existing CSV users remain compatible, but it is NOT suitable for strong identity security. Before public launch, add passwords or a real identity provider.
