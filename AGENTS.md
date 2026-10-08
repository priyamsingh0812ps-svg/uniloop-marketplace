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

## Architecture
- Supabase client lives in src/lib/supabase.ts with the user's own project URL + publishable key (not Lovable Cloud) — user requested their own project.
- Schema is versioned in supabase/migrations; listing fetchers fall back to sample data when tables are empty/missing so pages always render.
