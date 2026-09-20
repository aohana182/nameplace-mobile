# Nameplace Mobile

Pin the people you meet to the place you met them. Every name and note stays on your phone.

<p align="center">
  <img src="assets/screenshots/map.png" alt="Map with tag filters" width="22%">
  <img src="assets/screenshots/add-pin.png" alt="Add a connection pin" width="22%">
  <img src="assets/screenshots/pin-details.png" alt="Pin details" width="22%">
  <img src="assets/screenshots/manage-tags.png" alt="Manage tags" width="22%">
</p>

## Origin

The idea is Jacob Roberts's, the one and only. He came up with it on the porch of his apartment in Leucadia, San Diego County. This app is that idea, built.

## What it does

You meet someone. You keep the name, the notes and the spot on the map.

- Long-press the map, or tap **+** to drop a pin at the center of the screen. Save a name, notes and tags.
- Every connection is a colored pin. Tap it to see who it was and how you met. Edit or delete from the same sheet.
- Tags: Friend, Work, Family and Neighbor are built in. Add your own with a name and one of eight colors.
- A row of tag chips over the map filters the pins. Select one or more.
- The map reopens where you left it.

## Privacy

No accounts, no analytics, no backend. Pins live in an on-device SQLite database. The only network traffic is map tiles and styles from [OpenFreeMap](https://openfreemap.org), which needs no API key. Your pins, notes and GPS position are never sent anywhere.

## Status

Version 1.0.0, local-only, Android. Tested on a Samsung S24 and an Android emulator. It has never been built or run on iOS.

## Run it

Nameplace uses native modules (MapLibre, WatermelonDB), so it does not run in Expo Go. You need a development build: JDK 21 and the Android SDK.

```sh
git clone https://github.com/aohana182/nameplace-mobile.git
cd nameplace-mobile
npm install
npx expo run:android   # builds and installs the dev client
npm start              # starts Metro
```

Open the installed app on your device or emulator and it connects to Metro.

**Windows:** keep the checkout path short. The native build fails once a generated path passes 260 characters. [CONTRIBUTING.md](CONTRIBUTING.md) has the workaround.

## Test

```sh
npm test            # Jest + Testing Library
npx tsc --noEmit    # type-check, zero errors expected
```

## Stack

- Expo SDK 56, React Native 0.85, TypeScript
- MapLibre with OpenFreeMap vector tiles
- WatermelonDB on SQLite for storage and reactive queries
- `expo-location` for GPS, with a timeout so a slow fix can't hang the screen

## Layout

- `src/screens/`: the map screen
- `src/components/`: the add-pin, pin-details and manage-tags sheets, and the shared sheet overlay
- `src/model/`: schema, models, migrations, seed data
- `src/services/`: location
- `src/test/`: tests

Current state and build notes are in [HANDOFF.md](HANDOFF.md). Architecture decisions are in [DECISION_LOG.md](DECISION_LOG.md). Product requirements are in [PRD.md](PRD.md).

## Roadmap

None of this is built.

- **Play Store release.** Needs a release signing key, a real app icon, store graphics, a hosted privacy policy and Play Console setup. Checklist: [release/RELEASE_PREP.md](release/RELEASE_PREP.md).
- **iOS.** The code is cross-platform. It has not been tried.
- **Encrypted cloud backup (v2).** Opt-in. The key is derived on the device from your password, data is encrypted with AES-GCM-256 before upload, and the server stores only encrypted blobs. It needs a schema migration first. Design: [PRD.md](PRD.md) section 4.

## Contributing

Branching, commit format and the PR process are in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
