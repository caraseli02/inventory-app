# Grocery Inventory App

A tablet-first React + TypeScript application for scanning grocery items, syncing inventory to Airtable, and providing a clean UI for stock management. The project is built with Vite, TailwindCSS, and shadcn/ui components.

## Prerequisites
- Node.js 20+
- pnpm (recommended) or npm

## Installation
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create your environment file by copying the template:
   ```bash
   cp .env.example .env
   ```
3. Fill in the required values in `.env` (see below). **Never commit real credentials.**

## Environment Configuration
The app relies on Airtable for data storage. Configure the following variables in `.env`:

- `VITE_AIRTABLE_API_KEY`: Personal access token with read/write access to your Airtable base.
- `VITE_AIRTABLE_BASE_ID`: The Base ID for the inventory workspace.
- (Optional) `VITE_BACKEND_PROXY_URL` and `VITE_PROXY_AUTH_TOKEN`: Use when a backend proxy is available to avoid exposing Airtable credentials in the client.

See `.env.example` for placeholder values and security reminders.

## Usage
- Start the development server:
  ```bash
  pnpm dev
  ```
- Build for production:
  ```bash
  pnpm build
  ```
- Preview the production build locally:
  ```bash
  pnpm preview
  ```

## Documentation
- Docs Home: [`docs/README.md`](docs/README.md)
- Project architecture and folder structure: [`docs/project_architecture_structure.md`](docs/project_architecture_structure.md)
- Full documentation set is located in the [`docs/`](docs/) directory.

## Security & Limitations
- Airtable access currently happens directly from the client. Use a backend proxy when available to avoid exposing tokens.
- Keep `.env` files out of version control; only commit `.env.example`.
