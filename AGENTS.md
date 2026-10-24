<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Availability logic lives in pure `src/lib/availability.ts` (tested); server re-checks slots before insert and a DB exclusion constraint prevents overlapping appointments per barber.
- Appointments store snapshots of service names/prices so later price changes don't alter history.
- Public reads and booking writes go through server functions using the admin client; admin pages write via RLS (`is_admin()`).
- Admin is under `src/routes/_authenticated/admin*`; first admin is created on /login only while no admin exists.
- Images go to the private `media` bucket with long-lived signed URLs (public buckets are blocked in this workspace).
- All appointment emails go through `src/lib/notify.server.ts`, which logs every attempt in email_log for retry.
