# IdeaPark — System zarządzania parkingiem (Demo)

## Opis projektu

IdeaPark to demonstracyjny system zarządzania parkingiem pilotażowym dla Osiedla IDEA w Radomiu (deweloper: Unidevelopment S.A., ul. Listopadowa). Zawiera backend API (NestJS) oraz panel administracyjny (React + Vite).

## Architektura

- **Monorepo**: pnpm workspaces
- **Node.js**: v24
- **Package manager**: pnpm
- **Baza danych**: PostgreSQL (Replit managed)

### `artifacts/api-server` — Backend (NestJS)
- Framework: NestJS 11 + ts-node + SWC
- Storage: PostgreSQL via `pg` (Pool) — plik `src/common/db.ts` z inicjalizacją schematu i seed data
- **Auth**: JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) — hasła hashowane bcrypt (12 rounds), tokeny JWT 24h
- **Security**: helmet headers, CORS z Authorization header, global JwtAuthGuard, ValidationPipe (whitelist + forbidNonWhitelisted)
- Prefiks API: `/api`
- Port: `8080`
- Skrypt dev: `ts-node --swc -r reflect-metadata src/main.ts`

**Bezpieczeństwo:**
- `JwtAuthGuard` — globalny guard (APP_GUARD) na wszystkich endpointach; publiczne endpointy oznaczone dekoratorem `@Public()`
- `helmet` — security headers (CSP disabled for dev)
- `bcryptjs` — hashowanie haseł z 12 rundami salt
- JWT payload: `{ userId, firstName, lastName, stage, spaceCode, role }`
- userId pochodzi z tokenu JWT (nie z request body) — owner-only guards
- Hasło demo: `IdeaPark2026!` — auto-hash przy pierwszym logowaniu

**Moduły API:**
- `auth` — logowanie admin, `/api/auth/login` (@Public), `/api/auth/me` (JWT protected)
- `admin` — overview, spaces, reservations, guests (dla panelu admin, JWT protected)
- `spaces`, `shares`, `reservations`, `guests`, `access` — mobile app endpoints (starsze, JWT protected)
- `resident` — **GŁÓWNY moduł** aplikacji mieszkańca (PostgreSQL):
  - `POST /api/resident/login` — @Public, logowanie z hasłem → zwraca `{ token, user }`
  - `POST /api/resident/register` — @Public, rejestracja z hasłem (min 8 znaków) → zwraca `{ token, user }`
  - `GET /api/resident/demo-users` — @Public, lista kont demo
  - `GET /api/resident/sharing` — JWT protected, ogłoszenia udostępniania
  - `GET /api/resident/seeking` — JWT protected, ogłoszenia szukania
  - `POST /api/resident/sharing` — JWT protected, dodaj ogłoszenie (userId z tokenu)
  - `POST /api/resident/seeking` — JWT protected, dodaj szukanie (userId z tokenu)
  - `POST /api/resident/sharing/:id/request|accept|reject` — JWT protected, rezerwacja (userId z tokenu)
  - `POST /api/resident/seeking/:id/propose|accept-proposal|reject-proposal` — JWT protected
  - `GET /api/resident/chats` — JWT protected, wątki czatu (userId z tokenu)
  - `POST /api/resident/chats` — JWT protected, tworzenie wątku
  - `POST /api/resident/chats/:threadId/messages` — JWT protected, wysyłanie wiadomości
  - `GET /api/resident/notifications` — JWT protected, powiadomienia (userId z tokenu)
  - `POST /api/resident/notifications` — JWT protected, dodaj powiadomienie
  - `POST /api/resident/notifications/read` — JWT protected, oznacz jako przeczytane
- `reports` — podsumowanie KPI
- `health` — health check `/api/health` (@Public)

**Tabele PostgreSQL:**
- `residents` — mieszkańcy (id, first_name, last_name, **password_hash**, city, street, building, apartment, space_code, parking_type, stage, phone, role, **plate_number**)
- `sharing_entries` — ogłoszenia udostępniania miejsc (date_from/date_to: TIMESTAMPTZ — data + godzina; **vacated_at**: TIMESTAMPTZ; status: available/pending/confirmed/**completed**)
- `seeking_entries` — ogłoszenia szukania miejsc (date_from/date_to: TIMESTAMPTZ — data + godzina)
- `proposals` — propozycje do seeking entries
- `chat_threads` — wątki czatu
- `chat_messages` — wiadomości czatu
- `notifications` — powiadomienia użytkowników

**Konta demo** (hasło admin: `demo123`):
- `admin@ideapark.local` — Admin systemu
- `operator@ideapark.local` — Operator parkingu

### `artifacts/ideapark-admin` — Frontend (React + Vite)
- Framework: React 19 + Vite 7
- Routing: wouter v3
- Styl: własny CSS (dark navy theme, CSS variables)
- Port dev: `19079`
- Vite proxy: `/api` → `http://localhost:8080`
- Strony: Login, Dashboard, Miejsca, Rezerwacje, Goście, Raporty
- API client: `src/lib/residentApi.ts` — wrapper fetch z JWT Authorization header

**Aplikacja mobilna (ResidentBoard)** — widok mieszkańca (`/` i `/tablica`):
- UI w stylu BlaBlaCar/HelloPark — mobile-first z bottom navigation
- Ekrany: Logowanie/Rejestracja, Start (home), Tablica, Dodaj ogłoszenie, Powiadomienia, Profil, Czat
- Max-width 480px, na desktopie wyświetla się w ramce telefonu
- **Dane z PostgreSQL**: wszystkie operacje CRUD przez REST API (`residentApi.ts` → `/api/resident/*`)
- **JWT Auth**: token przechowywany w sessionStorage, wysyłany jako Bearer token; auto-logout przy 401
- **Rejestracja**: imię, nazwisko, **hasło (min 8 znaków)**, miasto, ulica, nr budynku, nr mieszkania, numer miejsca postojowego, typ parkingu (naziemne/podziemne), etap + weryfikacja SMS
- **Logowanie**: po imieniu, nazwisku i **haśle** via API; dostępne konta demo z szybkimi przyciskami (hasło demo: `IdeaPark2026!`)
- **Sharing flow**: Udostępnij miejsce (auto z profilu) → inny mieszkaniec "Zarezerwuj" → właściciel Akceptuj/Odrzuć
- **Seeking flow**: Szukam miejsca → sąsiad klika "Zaproponuj" (auto z profilu: kod + typ) → szukający Akceptuj/Odrzuć
- **Blokady biznesowe (server-side)**: (1) nie można zarezerwować swojego miejsca, (2) jedno aktywne udostępnienie per miejsce/daty, (3) jedna aktywna rezerwacja per użytkownik, (4) brak duplikatów propozycji, (5) sprawdzanie etapu
- **Owner-only guards**: userId pochodzi z JWT tokenu — użytkownik może modyfikować tylko swoje dane
- **Prawdziwe imiona**: UI pokazuje prawdziwe imiona i nazwiska (anonimizacja usunięta)
- **Weryfikacja SMS (OTP)**: demo: kod `123456` (`DEMO_SMS_CODE`)
- **Ochrona sesji**: sesja wygasa po 30 min bezczynności + auto-logout przy 401 Unauthorized
- **Wiadomości (czat)**: po rezerwacji strony mogą wymienić wiadomości; przechowywane w PostgreSQL
- **Powiadomienia**: feed przechowywany w PostgreSQL
- **Motywy (themes)**: Jasny, Beżowy, Ciemny — CSS variables + `data-theme` attribute
- **Języki (i18n)**: Polski (PL) i English (EN) — pełne tłumaczenia w `src/i18n.ts`
- **Swipe-to-archive**: przesunięcie palcem w lewo na ogłoszeniu (client-side only)
- **Dane**: Osiedle IDEA w Radomiu (Unidevelopment S.A.), ul. Listopadowa; etapy: Idea, Ogrody, Alfa, Omega, Leo, Venus, Orion, Aurora
- **Numery rejestracyjne (plate_number)**: przechowywane w tabeli residents; widoczne w karcie miejsca, profilu, kartach udostępniania (po potwierdzeniu), alertach
- **Alerty czasowe**: timer co 60s sprawdza confirmed sharing entries; 2h przed końcem → powiadomienie; po wygaśnięciu → modal vacate + powiadomienie; `confirmVacated` endpoint ustawia `vacated_at` + `status='completed'`
- **Endpointy vacate**: `POST /api/resident/sharing/:id/confirm-vacated`, `GET /api/resident/active-reservations`
- Konta demo (hasło: `IdeaPark2026!`): Anna Kowalska (Orion, P1-014, podziemne, WRA 54321), Tomasz Maj (Orion, P1-022, podziemne, WRA 12345), Ewa Jabłońska (Aurora, P2-041, podziemne, WRA 67890), Rafał Nowicki (Alfa, P3-007, naziemne, WRA 11223), Karol Wiśniewski (Orion, P1-005, podziemne, WRA 44556), Monika Dąbrowska (Aurora, P2-033, podziemne, WRA 77889), Piotr Lis (Alfa, P3-018, naziemne, WRA 99001)

## Ważne pliki

```
artifacts/api-server/src/main.ts                                — NestJS bootstrap + helmet + security
artifacts/api-server/src/app.module.ts                          — root module + global JwtAuthGuard
artifacts/api-server/src/common/db.ts                           — PostgreSQL pool, schema init, seed data
artifacts/api-server/src/common/jwt.ts                          — JWT sign/verify utilities
artifacts/api-server/src/common/auth.guard.ts                   — JwtAuthGuard (global) + @Public() decorator
artifacts/api-server/src/common/current-user.decorator.ts       — @CurrentUser() decorator
artifacts/api-server/src/modules/resident/resident.service.ts   — logika biznesowa residents + bcrypt
artifacts/api-server/src/modules/resident/resident.controller.ts — REST endpoints (userId from JWT)
artifacts/api-server/.swcrc                                     — konfiguracja SWC
artifacts/ideapark-admin/src/App.tsx                             — React router
artifacts/ideapark-admin/src/pages/ResidentBoard.tsx             — główna aplikacja mieszkańca
artifacts/ideapark-admin/src/lib/residentApi.ts                  — API client (JWT token + fetch wrapper)
artifacts/ideapark-admin/src/lib/api.ts                          — fetch helpers admin panel
artifacts/ideapark-admin/src/i18n.ts                             — tłumaczenia PL/EN
artifacts/ideapark-admin/src/resident.css                        — style aplikacji mieszkańca
```

## Komendy

```bash
# API server (dev)
pnpm --filter @workspace/api-server run dev

# Admin panel (dev)
pnpm --filter @workspace/ideapark-admin run dev

# Typecheck
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/ideapark-admin run typecheck
```

## Kluczowe uwagi techniczne

- **NestJS + tsx**: tsx używa esbuild, który nie emituje metadanych dekoratorów → trzeba `ts-node --swc`
- **SWC config**: `.swcrc` musi mieć `decoratorMetadata: true` i `legacyDecorator: true`
- **@nestjs/core**: musi mieć uruchomione build scripts (`onlyBuiltDependencies` w `pnpm-workspace.yaml`)
- **CORS**: NestJS ustawiony z `allowedHeaders: ['Content-Type', 'Authorization']`
- **JWT secret**: env `JWT_SECRET` lub `SESSION_SECRET`, domyślnie fallback
- **Helmet**: CSP disabled, CrossOriginEmbedderPolicy disabled (dev compatibility)
- **PostgreSQL**: Replit managed, connection via `DATABASE_URL` env var
- **sessionStorage**: JWT token przechowywany w sessionStorage (nie localStorage) for security
- **localStorage**: still used for: session timestamp, theme, language, home widgets — NOT for business data or tokens
