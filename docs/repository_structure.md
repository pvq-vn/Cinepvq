# Cinepvq Repository Structure & Multi-Client Organization

This document details the repository restructuring performed ahead of Phase 5 to support multiple client platforms (Web and native Android).

---

## 1. Structure Trước (Before Restructure)

Previously, the Next.js web application was nested under a redundant `cinepvq/cinepvq` directory within the Git root:

```
Cinepvq/ (Git Root)
├── .agents/
├── .env.example
├── .git/
├── .gitignore
├── cinepvq/                  <-- Nested web project folder
│   ├── app/
│   ├── components/
│   ├── services/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   ├── database/
│   ├── API/
│   ├── public/
│   ├── scratch/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── .env
│   ├── .env.local
│   ├── .gitignore
│   └── ...
├── docker-compose.yml
├── docs/
│   └── database.md
└── README.md
```

Issues with previous layout:
- Nested folder name `cinepvq/cinepvq` caused confusion between repository root and web client.
- No designated home for native mobile clients (such as Android).
- Inconsistent path resolution for scripts and tooling.

---

## 2. Structure Sau (After Restructure)

The repository is now organized as a clean, multi-client workspace:

```
Cinepvq/ (Git Root)
├── cinepvq-web/              <-- Full Next.js Web Client
│   ├── app/                  # Next.js App Router (Pages, Layouts, API routes)
│   ├── components/           # UI Components (Hero, Player, Cards, Rows)
│   ├── services/             # Video Sources, Resolvers, User Store, API
│   ├── hooks/                # React Hooks (Movies, User, Query)
│   ├── lib/                  # Database, Repositories, Supabase client
│   ├── types/                # TypeScript Interfaces & Definitions
│   ├── database/             # PostgreSQL Schemas, Migrations, Seeds
│   ├── API/                  # Upstream API documentation & specs
│   ├── public/               # Static assets & icons
│   ├── scratch/              # Integration and CDP test suites
│   ├── package.json          # Web dependencies and scripts
│   ├── next.config.ts        # Next.js & Turbopack config
│   ├── tsconfig.json         # TypeScript configuration
│   ├── eslint.config.mjs     # ESLint configuration
│   ├── .env                  # Web environment variables (git-ignored)
│   ├── .env.local            # Web local secrets (git-ignored)
│   ├── .env.example          # Web example environment configuration
│   ├── .gitignore            # Web-specific git-ignore rules
│   ├── docker-compose.yml    # Web-accessible Docker service
│   └── README.md             # Web client documentation
├── cinepvq-android/          <-- Native Android Application (Phase 5)
│   └── README.md             # Android architecture & tech stack roadmap
├── docs/                     # Shared Documentation
│   ├── database.md           # Unified Database schema & tables
│   └── repository_structure.md # This organization documentation
├── docker-compose.yml        # Repository-level Docker PostgreSQL service
├── .gitignore                # Repository-level Git ignore rules
└── README.md                 # Monorepo overview
```

---

## 3. Web Project Location

- **Absolute Directory:** `d:\Cinepvq\cinepvq-web`
- **Relative Path:** `./cinepvq-web`
- **Identity:** All Next.js source files, configuration, static assets, database migrations, and testing scripts reside strictly within `cinepvq-web/`.

---

## 4. Android Project Location

- **Absolute Directory:** `d:\Cinepvq\cinepvq-android`
- **Relative Path:** `./cinepvq-android`
- **Status:** Initialized as a structured placeholder containing a roadmap document. Active Kotlin / Jetpack Compose implementation begins in Phase 5.

---

## 5. Repository Root

- **Git Root Directory:** `d:\Cinepvq`
- **Corpus:** `pvq-vn/Cinepvq`
- Single unified Git history containing both web and future mobile clients.

---

## 6. Git Strategy

- **Single Repository:** No nested `.git` directories exist. Both `cinepvq-web` and `cinepvq-android` are subdirectories of the root repository.
- **History Preservation:** All tracked files were relocated using `git mv` and directory migration, ensuring Git detects renames (`R100` / `RM`) and preserves commit log provenance.
- **Clean Commit:** A dedicated commit (`chore: restructure repo for web and android`) tracks the restructuring without mixing unrelated feature changes.

---

## 7. Files Moved

- `cinepvq/app/**` → `cinepvq-web/app/**`
- `cinepvq/components/**` → `cinepvq-web/components/**`
- `cinepvq/services/**` → `cinepvq-web/services/**`
- `cinepvq/hooks/**` → `cinepvq-web/hooks/**`
- `cinepvq/lib/**` → `cinepvq-web/lib/**`
- `cinepvq/types/**` → `cinepvq-web/types/**`
- `cinepvq/database/**` → `cinepvq-web/database/**`
- `cinepvq/API/**` → `cinepvq-web/API/**`
- `cinepvq/public/**` → `cinepvq-web/public/**`
- `cinepvq/scratch/**` → `cinepvq-web/scratch/**`
- `cinepvq/package.json` → `cinepvq-web/package.json`
- `cinepvq/package-lock.json` → `cinepvq-web/package-lock.json`
- `cinepvq/next.config.ts` → `cinepvq-web/next.config.ts`
- `cinepvq/tsconfig.json` → `cinepvq-web/tsconfig.json`
- `cinepvq/eslint.config.mjs` → `cinepvq-web/eslint.config.mjs`
- `cinepvq/postcss.config.mjs` → `cinepvq-web/postcss.config.mjs`
- `cinepvq/.env*` → `cinepvq-web/.env*`
- `cinepvq/phase4_audit.md` → `cinepvq-web/phase4_audit.md`
- `cinepvq/node_modules/**` → `cinepvq-web/node_modules/**`
- `cinepvq/.next/**` → `cinepvq-web/.next/**`

---

## 8. Config / Path Changes

1. **Root `.gitignore`:**
   - Recursively ignores `node_modules/`, `**/.next/`, `.env*` across all subdirectories, ensuring zero secret leakage.
2. **Next.js `@/*` Import Aliases:**
   - Defined in `tsconfig.json` as `"@/*": ["./*"]`. Since the config resides in `cinepvq-web/`, all `@/*` aliases resolve properly to `cinepvq-web/*`.
3. **Database Scripts:**
   - `npm run db:migrate` and `npm run db:seed` run relative to `cinepvq-web/` against `database/migrate.mjs` and `database/seed.mjs`.

---

## 9. Validation

Validation was conducted within `d:\Cinepvq\cinepvq-web`:
- Dependencies verified intact with existing `node_modules`.
- Test suite execution in `cinepvq-web/scratch/`.
- Local dev server launched and verified.

---

## 10. Lint Result

Executed in `cinepvq-web/`:
```bash
npm run lint
```
- **Result:** `0 errors, 19 warnings` (standard Next.js img element suggestions).
- **Exit code:** `0` (PASS).

---

## 11. Build Result

Executed in `cinepvq-web/`:
```bash
npm run build
```
- **Result:** Compiled all 33/33 static and dynamic routes successfully in 8.4 seconds.
- **Exit code:** `0` (PASS).

---

## 12. Regression Result

Runtime integration verification conducted on `cinepvq-web`:
- **Home Performance 2.0:** Verified top 2-3 sections on mount, subsequent batches loaded on scroll.
- **Search & Discovery:** Filter logic and search endpoint `/api/proxy/nguonc/films/search` functional.
- **Movie Detail:** Route `/phim/[slug]` rendering movie metadata, server tabs, and episode list.
- **Video Player:** Multi-source priority (`K20 Direct -> VSMOV -> KKPhim -> NguonC`) intact.
- **Vietsub ↔ Thuyết Minh:** Verified audio track selection loads distinct CDN HLS streams.
- **Episode Switching:** Verified seamless stream change upon selecting new episode.
- **Auth & UX 2.0:** Verified `/dang-nhap`, `/yeu-thich`, `/lich-su`, and `/tai-khoan` routes.

---

## 13. Các vấn đề còn lại (Remaining Items)

- None. Repository restructure completed cleanly with zero breakage or regression.
