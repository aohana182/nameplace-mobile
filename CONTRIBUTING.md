# Contributing

## Setup

You need a current Node LTS, JDK 21 and the Android SDK. Nameplace uses native modules (MapLibre, WatermelonDB), so it does not run in Expo Go. It needs a development build.

```sh
git clone https://github.com/aohana182/nameplace-mobile.git
cd nameplace-mobile
npm install
npm test
npx tsc --noEmit
```

To run the app, build the Android development client once, then start Metro:

```sh
npx expo run:android
npm start
```

**Windows:** keep the checkout path short. The native build fails when a generated path passes 260 characters (ninja: "Filename longer than 260 characters"). A clone at something like `C:\bld` works. Details are in [HANDOFF.md](HANDOFF.md).

## Workflow

1. Branch from `master`: `git checkout -b feat/your-feature`
2. Make your change and add or update tests
3. Run `npm test` and `npx tsc --noEmit`. Both must be clean.
4. Commit with [Conventional Commits](https://www.conventionalcommits.org)
5. Open a pull request against `master`

## Commit format

```
type(scope): subject (max 72 chars)

- What changed
- Why it matters
- How verified
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

## Tests

Tests live in `src/test/` and run with Jest and `@testing-library/react-native`. The database is an in-memory LokiJS adapter, so no device is needed.

For a bug fix, write a test that fails on the old code first, then fix it. For layout bugs, also check on a device or emulator: jest does not compute layout, so it cannot catch a sheet that renders in the wrong place.

## Code style

There is no linter configured. The bar is `npx tsc --noEmit` with zero errors. Match the surrounding code, and comment only when the reason is not obvious.

## Database changes

The local database is the product. If you change the schema version, ship a migration in `src/model/migrations.ts`. Bumping the version without one wipes every existing user's data.
