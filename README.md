# Sinapse 3 Backend

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and adjust the values for your environment. The sample `DATABASE_URL` targets the PostgreSQL `core` schema with `?schema=core`.

3. Validate the Prisma schema:

   ```bash
   npx prisma validate
   ```

4. Start the app in development:

   ```bash
   npx ts-node src/main.ts
   ```

## Environment

The app requires these variables at runtime:

- `DATABASE_URL`: PostgreSQL connection string used by Prisma. For this slice, include `?schema=core` so Prisma targets the `core` PostgreSQL schema.
- `AUTH_JWT_SECRET`: shared secret for JWT signing and verification.
- `AUTH_JWT_ISSUER`: expected JWT issuer value.
- `AUTH_JWT_AUDIENCE`: expected JWT audience value.

Optional values:

- `NODE_ENV`: defaults to `development`.
- `PORT`: defaults to `3000`.

The app validates the environment at bootstrap and fails fast if any required variable is missing or empty.
