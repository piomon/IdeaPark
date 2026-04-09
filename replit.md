# IdeaPark — System Zarządzania Parkingiem

Demo system parkingowy dla Osiedla IDEA w Radomiu (Unidevelopment S.A., ul. Listopadowa).
Parking management demo: NestJS REST API + React/Vite admin panel + resident mobile app.

## Architektura

Monorepo pnpm z dwoma głównymi artefaktami:

### 1. API Server (`artifacts/api-server`)
- **Stack**: NestJS 11 + PostgreSQL (pg Pool) + JWT + bcrypt + helmet
- **Port**: 8080
- **Dev**: `ts-node --swc -r reflect-metadata src/main.ts`
- **Baza danych**: PostgreSQL (tabele: residents, sharing_entries, seeking_entries, proposals, chat_threads, chat_messages, notifications) + JSON file store (`data/runtime-db.json`) dla panelu admina
- **Auth**: JWT (jsonwebtoken), payload: `{ userId, tenantId, email, role }`
- **Security**: helmet, CORS, JWT auth guard (global), bcrypt passwords

#### Moduły NestJS
- **AuthModule**: POST /api/auth/login, GET /api/auth/me
- **DashboardModule**: GET /api/dashboard/summary
- **SpacesModule**: GET /api/spaces, GET /api/spaces/mine, GET /api/spaces/:id
- **SharesModule**: GET /api/shares/mine, POST /api/shares
- **ReservationsModule**: GET /api/reservations/mine, POST /api/reservations, DELETE /api/reservations/:id
- **GuestsModule**: GET /api/guests/mine, POST /api/guests
- **AccessModule**: POST /api/access/open, GET /api/access/history
- **AdminModule**: GET /api/admin/overview, spaces, reservations, guests
- **ReportsModule**: GET /api/reports/summary
- **HealthModule**: GET /api/health, POST /api/reset
- **ResidentModule**: Pełna aplikacja mieszkańca:
  - POST /api/resident/login, /register, GET /demo-users
  - GET/POST sharing, seeking
  - POST sharing/:id/request, accept, reject, confirm-vacated
  - POST seeking/:id/propose, accept-proposal, reject-proposal
  - GET active-reservations, chats, notifications
  - POST chats, chats/:threadId/messages, notifications, notifications/read

#### Dane demo — Admin
| Email | Rola | Hasło |
|---|---|---|
| admin@ideapark.local | admin | demo123 |
| operator@ideapark.local | operator | demo123 |
| anna@ideapark.local | resident | demo123 |
| jan@ideapark.local | resident | demo123 |

#### Dane demo — Mieszkańcy (PostgreSQL)
| Imię | Etap | Miejsce | Tablica | Hasło |
|---|---|---|---|---|
| Anna Kowalska | Orion | P1-014 | WRA 54321 | IdeaPark2026! |
| Tomasz Maj | Orion | P1-022 | WRA 12345 | IdeaPark2026! |
| Ewa Jabłońska | Aurora | P2-041 | WRA 67890 | IdeaPark2026! |
| Rafał Nowicki | Alfa | P3-007 | WRA 11223 | IdeaPark2026! |
| Karol Wiśniewski | Orion | P1-005 | WRA 44556 | IdeaPark2026! |
| Monika Dąbrowska | Aurora | P2-033 | WRA 77889 | IdeaPark2026! |
| Piotr Lis | Alfa | P3-018 | WRA 99001 | IdeaPark2026! |

### 2. Frontend (`artifacts/ideapark-admin`)
- **Stack**: React 19 + Vite 7 + TypeScript + Tailwind CSS + wouter v3
- **Port**: 19079 (proxied na `/`)
- **API proxy**: Vite proxy `/api` → `localhost:8080`

#### Strony

**Panel administracyjny** (chronione JWT):
- `/login` — logowanie admina z listą kont demo
- `/dashboard` — KPI, ostatnie rezerwacje, log aktywności
- `/spaces` — tabela miejsc parkingowych z filtrowaniem
- `/reservations` — tabela rezerwacji z filtrowaniem
- `/guests` — tabela przepustek gościnnych z QR kodami
- `/reports` — KPI + wykres słupkowy + dostępne akcje

**Aplikacja mieszkańca** (publiczna):
- `/` i `/tablica` — ResidentBoard (mobile-first, max 480px)
  - Bottom navigation: Start, Tablica, Dodaj, Powiadomienia, Profil
  - Motywy: Jasny / Beżowy / Ciemny (CSS variables)
  - Języki: Polski (PL) / English (EN) — pełne tłumaczenia (i18n.ts)
  - Udostępnianie miejsc (Sharing flow)
  - Szukanie miejsc (Seeking flow)
  - Czat między stronami
  - Alerty czasowe (timer, modal vacate)
  - RODO anonimizacja (Imię L.)
  - Regulamin (10 paragrafów PL+EN)
  - Numery rejestracyjne
  - Weryfikacja SMS demo (kod: 123456)

## Kluczowe pliki

```
artifacts/
├── api-server/
│   ├── src/
│   │   ├── main.ts              # NestJS bootstrap
│   │   ├── app.module.ts        # Root module
│   │   ├── common/
│   │   │   ├── auth.guard.ts    # JWT auth guard (global)
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── db.ts            # PostgreSQL init + seed
│   │   │   ├── jwt.ts           # JWT sign/verify
│   │   │   ├── models.ts        # TypeScript types (JSON store)
│   │   │   ├── seed.ts          # Demo data (JSON store)
│   │   │   ├── store.service.ts # JSON file persistence
│   │   │   └── utils.ts         # Helpers
│   │   └── modules/
│   │       ├── auth/            # Auth controller + service
│   │       ├── admin/           # Admin panel endpoints
│   │       ├── dashboard/       # Dashboard KPIs
│   │       ├── spaces/          # Parking spaces
│   │       ├── shares/          # Sharing management
│   │       ├── reservations/    # Reservation management
│   │       ├── guests/          # Guest passes
│   │       ├── access/          # Gate access
│   │       ├── reports/         # Reports & stats
│   │       ├── health/          # Health check + reset
│   │       └── resident/        # Resident mobile app (506 lines service)
│   ├── .swcrc                   # SWC config for NestJS decorators
│   └── tsconfig.build.json      # Build config
└── ideapark-admin/
    ├── src/
    │   ├── App.tsx              # Router (ResidentBoard + admin)
    │   ├── i18n.ts              # PL/EN translations (571 lines)
    │   ├── index.css            # Admin dark theme (717 lines)
    │   ├── resident.css         # Resident mobile theme (1076 lines)
    │   ├── lib/
    │   │   ├── api.ts           # Admin API client
    │   │   └── residentApi.ts   # Resident API client
    │   ├── components/
    │   │   ├── Shell.tsx        # Admin sidebar layout
    │   │   ├── AuthGate.tsx     # Auth protection wrapper
    │   │   ├── Card.tsx         # Card component
    │   │   └── MetricCard.tsx   # KPI metric card
    │   └── pages/
    │       ├── Login.tsx        # Admin login
    │       ├── Dashboard.tsx    # Admin dashboard
    │       ├── Spaces.tsx       # Spaces management
    │       ├── Reservations.tsx # Reservations management
    │       ├── Guests.tsx       # Guests management
    │       ├── Reports.tsx      # Reports & analytics
    │       └── ResidentBoard.tsx # Resident mobile app (1144 lines)
    └── vite.config.ts           # Vite + proxy config
```

## Etapy osiedla
Idea, Ogrody, Alfa, Omega, Leo, Venus, Orion, Aurora

## Uruchamianie

Oba workflowy uruchamiają się automatycznie:
- `artifacts/api-server: API Server` → NestJS na porcie 8080
- `artifacts/ideapark-admin: web` → Vite na porcie 19079
