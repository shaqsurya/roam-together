# Roam Together

[Open the travel app](https://shaqsurya.github.io/roam-together/)

A free web-based workspace for itineraries, locations, budgets, shared costs, upfront payments, and repayments. Works on phones and laptops with no app-store install.

## Use it

Open the app and choose **New trip** in the top bar, or explore the fictional sample trip. The New trip button is available on every screen, including mobile. To switch existing trips, use **Trip → Switch adventure**. Today shows the next stops; Plan holds the itinerary and planned payments; Money shows each person's share and who pays whom; Trip holds friends, settings, checklists, and backups.

Trips can stay on your device or use the connected free Firebase database. Choose **Invite friends → Share this trip live**, sign in with Google, and copy the invite link. Friends request access; approve them and link their traveler in **Trip**. Live changes sync for approved members. Export a JSON backup before clearing local browser data.

## Live sharing at $0

This deployment is connected to Firebase project `roam-together-1c722` on Spark. Google sign-in is enabled and the access rules are published. No billing account is linked. The steps below are for deploying your own independent copy.

1. Create a Firebase project on Spark and keep Cloud Billing unlinked.
2. Enable Google sign-in in Firebase Authentication and add `shaqsurya.github.io` to authorized domains.
3. Create a Standard edition Firestore database, then publish the supplied `firestore.rules`. Do not use public test-mode rules.
4. Replace `null` in `firebase-config.js` with the public web app configuration from Firebase. Never upload a service account key or private token.
5. Commit that file. Once GitHub Pages deploys, choose Invite friends → Share this trip live. Friends request access, and the owner approves and links their named traveler in Trip.

Free quotas apply to the whole Firebase project. If a quota is reached, service may pause until it resets; the app never needs billing enabled. Use manual exchange rates, external receipt links, map links, and browser printing to keep paid integrations out.

## Source and tests

The files at this repository's root are the ready-to-serve website. GitHub Pages publishes `main` → `/ (root)`.

[Download the complete developer project](./roam-together-source.zip) for the test suites, deployment workflow, detailed setup guide, and local development server. It includes 29 calculation/import/export tests and 19 Firestore access-rule tests.

For a simple app update, replace the matching root website files from the developer project's `dist/` folder. For a full-source GitHub Actions deployment, extract the developer project into a separate repository and follow its README.
