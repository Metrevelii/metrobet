# Metrobet

Online betting platform: sportsbook, casino (slots) and crash games, plus a staff backoffice.

```bash
nvm use && corepack enable
pnpm install
docker compose up -d && cp apps/api/.env.example apps/api/.env
pnpm dev   # web :3000 · backoffice :3001 · api :4000
```

Architecture, conventions and roadmap: see [CLAUDE.md](CLAUDE.md) and the `CLAUDE.md` inside each app/package.
