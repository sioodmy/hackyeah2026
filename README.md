# Safe Call

**Alarm, który wygląda jak mapa.**

Aplikacja na telefon wygląda z daleka jak zwykła mapa OSM. Suwak na dole ekranu
jest poziome paskiem — dopiero pociągnięcie i puszczenie uruchamia akcję. Do
zagrożenia służy jedno, znane gesty i nic, co krzyczy „alarm” na ekranie.

| Poziom | Kolor        | Co się dzieje                                                     |
| ------ | ------------ | ----------------------------------------------------------------- |
| 0      | szary        | spokój, suwak w pozycji spoczynkowej                              |
| 1      | żółty        | po 10 s ciszy wjeżdża fałszywe połączenie — pretekst, żeby wyjść  |
| 2      | pomarańczowy | to samo + znajomi dostają lokalizację i prośbę: „zadzwoń do mnie” |
| 3      | czerwony     | pełnoekranowy alarm u znajomych + powiadomienie służb (mock)      |

Znajomi widzą nawzajem swoją lokalizację na żywo. Dodajecie się przez skanowanie
kodu QR.

## Stack

- **mobile** — Expo SDK 57, React Native 0.86, TypeScript, expo-router
  (`react-native-maps` + kafelki OSM, `react-native-reanimated` + `gesture-handler`
  na suwaku, `expo-blur`, `expo-haptics`, `expo-camera`, Clerk)
- **server** — Node 22, Fastify 5, Drizzle ORM, PostgreSQL, WebSocket (`ws`)
- **shared** — typy i schematy zod współdzielone przez apkę i serwer
- **infra** — Nix flake (treefmt-nix, pełny devshell), Docker Compose

## Struktura

```
apps/mobile        aplikacja Expo (Android priorytet, iOS działa)
apps/server        API + WebSocket + mock służb
packages/shared    kontrakt: typy, schematy zod, nazwy eventów WS
docker/            Dockerfile serwera
flake.nix          devshell, formater, pakiety
```

## Start

### 1. Zmienne środowiskowe

```sh
cp .env.example .env
# uzupełnij EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY i CLERK_SECRET_KEY,
# albo zostaw puste i włącz tryb demo (patrz niżej)
```

### 2. Baza danych

```sh
docker compose up -d postgres     # albo: pnpm db:up
pnpm --filter @safecall/server db:migrate
pnpm --filter @safecall/server db:seed   # opcjonalnie: dwie demo-osoby
```

Adminer (podgląd bazy) jest pod `http://localhost:8080`.

### 3. Serwer

```sh
pnpm dev                 # http://localhost:4000, /health bez autoryzacji
```

### 4. Aplikacja

```sh
pnpm --filter @safecall/mobile start
```

Zeskanuj kod QR Expo Go telefonem. Emulator Androida nie widzi hosta przez
`localhost` — domyślnie ustawione `10.0.2.2`. Na fizycznym telefonie podaj IP
komputera w sieci lokalnej (`EXPO_PUBLIC_API_HOST`).

## Tryb demo bez Clerka

Jeśli `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` nie jest ustawione, aplikacja wchodzi w
tryb demo, a serwer (ustawiony z pustym `CLERK_SECRET_KEY`) ufa nagłówkowi
`x-dev-user`. Do testowania na dwóch telefonach bez konfiguracji Clerka:

```sh
DEV_AUTH=1 pnpm dev
```

## Devshell Nix

```sh
nix develop          # node 24, pnpm, postgres, docker, android-tools, jq, fd, …
nix fmt              # treefmt: deadnix, statix, nixfmt, shellcheck, shfmt, prettier
nix flake check      # ewaluje wszystkie systemy
```

Flake wspiera `x86_64-linux`, `aarch64-linux` i `aarch64-darwin`.
`nix build` instaluje README do `result/`.

## Zmienne środowiskowe

Pełna lista z komentarzami w `.env.example`. Najważniejsze:

| Zmienna                                      | Do czego                                                |
| -------------------------------------------- | ------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL` | adres serwera z telefonu                                |
| `EXPO_PUBLIC_TILE_URL`                       | kafelki OSM; domyślnie stonowany CARTO `light_all`      |
| `EXPO_PUBLIC_FAKE_CALL_DELAY_MS`             | po ilu sekundach wjeżdża fałszywe połączenie            |
| `EXPO_PUBLIC_HOLD_TO_STAND_DOWN_MS`          | ile trzymać środek szyny, aby wyłączyć alarm            |
| `CLERK_SECRET_KEY` / `DEV_AUTH`              | autoryzacja na serwerze                                 |
| `EXPO_ACCESS_TOKEN`                          | push przez Expo; bez tego powiadomienia idą tylko po WS |

## Test dwóch telefonów

1. Oba telefony: ten sam serwer, ta sama baza.
2. Telefon A → Ustawienia → Znajomi → pokaż QR.
3. Telefon B → Skanuj kod → dodaj A.
4. Na A przesuń suwak na poziom 3.
5. Na B powinien wyskoczyć pełnoekranowy alarm z lokalizacją A, a w logu
   serwera pojawi się blokada `MOCK DISPATCH` z numerem referencyjnym.

## Ważne

Aplikacja **nie dzwoni do służb naprawdę**. `POST /api/dispatch` to mock, który
zwraca referencję i sztuczny log operatora — służy do pokazu i testów. Prawdziwe
wdrożenie wymaga integracji z numerem alarmowym i zgodami; `DispatchProvider` w
`apps/server/src/services/mock-dispatch.ts` jest po to odseparowane.
