# Roam Together

[Open the travel app](https://shaqsurya.github.io/roam-together/)

A free web-based workspace for itineraries, locations, budgets, shared costs, upfront payments, and repayments. Works on phones and laptops with no app-store install.

## Use it

Open the app and choose **New trip** in the top bar, or explore the fictional sample trip. The New trip button is available on every screen, including mobile. To switch existing trips, use **Trip & friends → Switch adventure**. Overview provides shortcuts for friends, budget, activities, and expenses. Itinerary holds your stops and planned payments. Budget & costs shows the spending forecast, each person's share, and who pays whom. Trip & friends holds travelers, settings, checklists, and backups.

Trips can stay on your device or use the connected free Firebase database. Choose **Invite friends → Save to cloud & get link**. The creator signs in with Google once. Anyone holding the trip link can open and edit it immediately, without guest sign-in or approval. On an older trip, the owner selects **Invite friends → Enable link sharing** once; the existing link then works immediately. Export a JSON backup before clearing local browser data.

## Set your budget

Choose **Set budget** on Overview or Budget & costs. Enter one total for the whole group in the trip currency, then choose **Save budget**. For example, four friends with 300 each have a total budget of 1200. The form previews an approximate allowance per traveler.

The budget is a spending limit. **Add planned cost** estimates future spending and selects the upfront payer. **Add expense** records an actual payment and calculates shares and balances. Budget & costs shows spending plus unpaid plans against your limit.

## Personal or shared expenses

Choose **Add expense → Personal — no split** for an individual purchase. Only the selected traveler pays and bears that cost; split controls are hidden, and no debt to friends is created. Personal expenses remain visible in a shared trip. Choose **Shared with friends** to select participants and split a shared payment.

## Live sharing at $0

This deployment is connected to Firebase project `roam-together-1c722` on Spark. Google sign-in is enabled and the access rules are published. No billing account is linked. The steps below are for deploying your own independent copy.

1. Create a Firebase project on Spark and keep Cloud Billing unlinked.
2. Enable Google sign-in in Firebase Authentication and add `shaqsurya.github.io` to authorized domains.
3. Create a Standard edition Firestore database, then publish the supplied `firestore.rules`. Do not use public test-mode rules.
4. Replace `null` in `firebase-config.js` with the public web app configuration from Firebase. Never upload a service account key or private token.
5. Commit that file. Once GitHub Pages deploys, choose Invite friends → Share this trip live. Friends open the link immediately and choose their traveler for the money view.

Free quotas apply to the whole Firebase project. If a quota is reached, service may pause until it resets; the app never needs billing enabled. Use manual exchange rates, external receipt links, map links, and browser printing to keep paid integrations out.

## Source and tests

The files at this repository's root are the ready-to-serve website. GitHub Pages publishes `main` → `/ (root)`.

[Download the complete developer project](./roam-together-source.zip) for the test suites, deployment workflow, detailed setup guide, and local development server. It includes 32 calculation/import/export tests and 27 Firestore access-rule tests.

For a simple app update, replace the matching root website files from the developer project's `dist/` folder. For a full-source GitHub Actions deployment, extract the developer project into a separate repository and follow its README.
