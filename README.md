# Roam Together

[Open the travel app](https://shaqsurya.github.io/roam-together/)

A free web-based workspace for itineraries, locations, budgets, shared costs, upfront payments, and repayments. Works on phones and laptops with no app-store install.

## Use it

Open the app and choose **Create your own adventure**, or explore the fictional sample trip. Today shows the next stops; Plan holds the itinerary and planned payments; Money shows each person's share and who pays whom; Trip holds friends, settings, checklists, and backups.

The app currently saves trips on your device. Export a JSON backup before clearing browser data or switching devices. **Live group editing requires connecting a Firebase Spark project.** An invitation link does not sync local-only data.

## Live sharing at $0

1. Create a Firebase project on Spark and keep Cloud Billing unlinked.
2. Enable Google sign-in in Firebase Authentication and add `shaqsurya.github.io` to authorized domains.
3. Create a Standard edition Firestore database, then publish the supplied `firestore.rules`. Do not use public test-mode rules.
4. Replace `null` in `firebase-config.js` with the public web app configuration from Firebase. Never upload a service account key or private token.
5. Commit that file. Once GitHub Pages deploys, choose Invite friends → Share this trip live. Friends request access, and the owner approves and links their named traveler in Trip.

Free quotas apply to the whole Firebase project. If a quota is reached, service may pause until it resets; the app never needs billing enabled. Use manual exchange rates, external receipt links, map links, and browser printing to keep paid integrations out.

## Source and tests

The files at this repository's root are the ready-to-serve website. GitHub Pages publishes `main` → `/ (root)`.

[Download the complete developer project](./roam-together-source.zip) for the test suites, deployment workflow, detailed setup guide, and local development server. It includes 28 calculation/import/export tests and 19 Firestore access-rule tests.

For a simple app update, replace the matching root website files from the developer project's `dist/` folder. For a full-source GitHub Actions deployment, extract the developer project into a separate repository and follow its README.
