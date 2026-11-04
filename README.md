# Too High To…

The people's chart of elevated states. Visitors submit statements that finish the phrase "Too high to…" and vote them **▲ Higher** or **▼ Lower**. The top 10 are ranked by *highness*, with the highest state at the top of the chart.

This is a static site (plain HTML, CSS and JS) hosted on GitHub Pages. Votes and submissions are stored in a free Supabase Postgres database.

## Try it locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

When `config.js` is empty, the site runs in **demo mode**: posts and votes are saved in your browser only.

## Connect the shared database (Supabase)

1. Create a free project at <https://supabase.com>. Signing in with GitHub works.
2. Open **SQL Editor → New query**, paste in all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the tables, the access rules, the three write functions and the starter statements.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key into `config.js`.
4. Reload the page. The demo-mode banner should be gone.

### How the data is protected

- Row Level Security is on. The public anon key can only **read** `statements`. It cannot read `votes` at all.
- Every write goes through `submit_statement`, `cast_vote` and `my_votes`. These are `security definer` functions that validate their input: 3–80 characters, duplicates rejected regardless of case, and votes limited to −1, 0 or 1.
- Each browser gets a random anonymous voter id and can cast one vote per statement. Clearing site data gives you a new id, so this is not proof against cheating, but it's good enough for a joke site.

## Publish on GitHub Pages

1. Push this folder to a public repo, e.g. `sftbiesai/toohighto`.
2. Go to **Settings → Pages → Build and deployment**, pick **Deploy from a branch**, then `main` and `/ (root)`.
3. The site will be live at `https://sftbiesai.github.io/toohighto/`.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page structure and the inline SVG cover art |
| `styles.css` | 70s paperback styling and the Highness chart layout |
| `app.js` | Data loading, voting, submitting and rendering |
| `config.js` | Supabase URL and anon key |
| `supabase/schema.sql` | Database schema, access rules, functions and seed data |
