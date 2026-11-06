# Aara Rugs API

Node.js, Express and MongoDB API for the Aara storefront and admin panel.

## Start

1. Install Node.js 20 or newer and MongoDB Community, Atlas or another MongoDB-compatible service.
2. Run `npm install` in this folder.
3. Copy `.env.example` to `.env`; set `MONGODB_URI`, a random `JWT_SECRET`, and a strong `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
4. Run `npm run dev`. The API listens on port 4000 by default.
5. Start the storefront and admin Vite apps. Configure their API URL to `http://localhost:4000` if needed.

`GET /api/storefront` returns the active brand settings, homepage settings, categories, products and pages. `/api/admin/*` requires a bearer token from `POST /api/auth/login`. Login is rate-limited and the API validates write payloads. Use HTTPS and secrets from the deployment secret manager in production.

Image fields accept publicly reachable image URLs. For production uploads, connect an object-storage provider and save its returned URL in these fields; do not store uploaded files on an ephemeral server disk.
