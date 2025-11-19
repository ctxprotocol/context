This directory previously contained an alternative admin tools implementation.
The canonical admin tools route now lives under:

- `app/(chat)/admin/tools/page.tsx`

The top-level `app/admin` segment is intentionally kept minimal to avoid
duplicate routes resolving to `/admin/tools`.


