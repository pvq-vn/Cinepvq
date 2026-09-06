# Cinepvq — Multi-Platform Cinematic Streaming Ecosystem

Cinepvq is a modern movie and television streaming platform offering high-performance browsing, intelligent search & discovery, multi-source video streaming, and seamless user synchronization.

## Monorepo Architecture

```
Cinepvq/
├── cinepvq-web/          # Next.js 16 (Turbopack, React 19) Web Client
├── cinepvq-android/      # Native Android Application (Planned Phase 5)
├── docs/                 # Shared Architecture & Specification Documents
├── docker-compose.yml    # Shared Local PostgreSQL Infrastructure
├── .gitignore            # Repository-wide Git Ignore Rules
└── README.md             # Monorepo Documentation
```

## Subprojects

### 1. [Cinepvq Web](./cinepvq-web)
- **Framework:** Next.js 16.2.12 (Turbopack, App Router)
- **Library:** React 19
- **Styling:** Tailwind CSS / CSS Variables / Vanilla CSS
- **Media Engine:** HLS.js with Multi-Source Fallback (K20 Direct CDN, VSMOV, KKPhim, NguonC)
- **State & Data:** TanStack React Query, Zustand
- **Database / Auth:** PostgreSQL, Supabase SSR / Client

### 2. [Cinepvq Android](./cinepvq-android)
- **Target:** Phone, Tablet, and Android TV
- **Language:** Kotlin
- **Media Engine:** AndroidX Media3 / ExoPlayer
- **Status:** Planned for Phase 5

### 3. [Shared Documentation](./docs)
- [`database.md`](./docs/database.md): Database schema, tables, and migrations.
- [`repository_structure.md`](./docs/repository_structure.md): Repository organization and directory layout guide.

---

## Quick Start (Web Development)

```bash
# Navigate to web application
cd cinepvq-web

# Install dependencies (if needed)
npm install

# Run local development server
npm run dev

# Run linting & type checks
npm run lint
npm run build
```

Database containers can be spun up using the shared root docker configuration:
```bash
docker compose up -d
```
