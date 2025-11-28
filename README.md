# USIU Events Hub

A responsive, accessible events platform for United States International University–Africa (USIU-A), built with HTML, CSS, vanilla JavaScript and Firebase. The project includes user and admin workflows, event listing and registration, image uploads to Firebase Storage, and an optional M-Pesa STK push payment flow via Cloud Functions.

Live demo: https://rayynaldgitau.github.io/USIU-EVENT-WEBPAGE-GROUP-PROJECT-FOR-APT1040/

---

## Table of contents

- [Key features](#key-features)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local development](#local-development)
- [Configuration](#configuration)
  - [Firebase client config](#firebase-client-config)
  - [Firebase functions (M-Pesa) config](#firebase-functions-m-pesa-config)
  - [EmailJS config (ticket emails)](#emailjs-config-ticket-emails)
- [How it works / Architecture](#how-it-works--architecture)
  - [Frontend flows](#frontend-flows)
  - [Backend flows (Cloud Functions)](#backend-flows-cloud-functions)
- [Important files & code references](#important-files--code-references)
- [Deployment instructions](#deployment-instructions)
- [Testing & Troubleshooting](#testing--troubleshooting)
- [Security & Production notes](#security--production-notes)
- [Contributing](#contributing)
- [License](#license)

---

## Key features

User / Student features:
- Browse upcoming events and view featured events ([index.html](index.html)).
- Search and filter events ([EventsListView.html](EventsListView.html)).
- Event details modal with registration button ([index.html](index.html), [EventsListView.html](EventsListView.html)).
- Register for an event (free or paid) using the registration form ([eventRegister.html](eventRegister.html)).
- Password reset and authentication flows ([loginPage.html](loginPage.html), [registerPage.html](registerPage.html), [forgotPassword.html](forgotPassword.html)).

Admin features:
- Add new events with title, description, date/time, price, category and poster image ([addEvent.html](addEvent.html)).
- Admins have protected routes (controlled by [`ADMIN_EMAILS`](JS/script.js)).

Extras:
- M-Pesa STK push support via Cloud Functions (`functions/`).
- EmailJS ticket-sending integration for a frontend email receipt (`JS/script.js`).
- Image uploads to Firebase Storage and retrieval for event images (`JS/script.js`).

---

## Project structure

- [index.html](index.html): Home page (featured events, stats).
- [EventsListView.html](EventsListView.html): Events listing + search/filter UI.
- [eventRegister.html](eventRegister.html): Event registration page.
- [EventDetails.html](EventDetails.html): Event-specific page (legacy/placeholder).
- [addEvent.html](addEvent.html): Admin add-event page.
- [loginPage.html](loginPage.html), [registerPage.html](registerPage.html), [forgotPassword.html](forgotPassword.html): Auth UI pages.
- [Gallery.html](Gallery.html), [aboutPage.html](aboutPage.html), [contact.html](contact.html): Supporting pages.
- [css/styles.css](css/styles.css): Global styles and responsive rules.
- [JS/script.js](JS/script.js): Main frontend logic (all UI + Firebase usage).
- [JS/firebaseConfig.js](JS/firebaseConfig.js): Client Firebase config + initialization.
- [JS/index.js](JS/index.js): Example Node script (server-side) illustrating MPESA STK push usage.
- [functions/index.js](functions/index.js): Cloud Function sample for STK push + callback processing.

---

## Getting started

### Prerequisites
- Node.js (if you want to run Cloud Functions locally).
- Firebase CLI: `npm i -g firebase-tools`.
- Optional: `live-server` or VS Code Live Server extension to preview pages.

### Local development
1. Clone the repository:
   ```bash
   git clone https://github.com/rayynaldgitau/USIU-EVENT-WEBPAGE-GROUP-PROJECT-FOR-APT1040.git
   cd USIU-EVENT-WEBPAGE-GROUP-PROJECT-FOR-APT1040
   ```
2. Preview the site:
   - Using VS Code Live Server or:
     ```bash
     npx http-server -c-1
     # or
     npx live-server
     ```
3. Open the pages in your browser:
   - Home page: http://127.0.0.1:8080/index.html
   - Events list: http://127.0.0.1:8080/EventsListView.html
   - Add Event (admin): http://127.0.0.1:8080/addEvent.html
   - Event register: http://127.0.0.1:8080/eventRegister.html?id=<EVENT_ID>

---

## Configuration

### Firebase client config
- Edit [`JS/firebaseConfig.js`](JS/firebaseConfig.js) to add your Firebase project credentials if you use your own project. Example keys are already present for demo, but you should replace them.
- This script initializes Firebase services:
  - [`auth`](JS/firebaseConfig.js)
  - [`storage`](JS/firebaseConfig.js)
  - [`db`](JS/firebaseConfig.js)

### Firebase functions (M-Pesa) config
- The Cloud Functions implementation is in [`functions/index.js`](functions/index.js) and [`JS/index.js`](JS/index.js).
- To set M-Pesa credentials (DO NOT store secrets in code) use Firebase environment config:
  ```bash
  firebase functions:config:set mpesa.consumer_key="YOUR_KEY" mpesa.consumer_secret="YOUR_SECRET" mpesa.shortcode="SHORTCODE" mpesa.passkey="PASSKEY"
  ```
- Deploy functions:
  ```bash
  cd functions
  npm install
  cd ..
  firebase deploy --only functions
  ```
- The Cloud Function implements:
  - oauth token fetch (`getAccessToken` in [`functions/index.js`](functions/index.js)).
  - STK push (`mpesaStkPush`).
  - STK callback processing that updates Firestore registration documents.

> Note: `functions/index.js` currently includes local demo credentials; make sure to move them to env config before deploying.

### EmailJS config (ticket emails)
- EmailJS is used in [`JS/script.js`](JS/script.js) to optionally send confirmation tickets to the attendee.
- The service/template/public keys are defined in `script.js`:
  ```js
  const SERVICE_ID = "service_03hfprr";
  const TEMPLATE_ID = "template_2csh4gj";
  const PUBLIC_KEY = "ZPs-uhpAwpEvsD2rx";
  ```
- Replace with your EmailJS keys or configure them in your deployment process.

---

## How it works / Architecture

### Frontend flows
- Event listing:
  - Firestore is read via `loadEventsList()` in [`JS/script.js`](JS/script.js).
  - Each event is built with `buildEventCard(ev)` and appended to the DOM.
  - The search bar filters client-side.
- Event registration:
  - The register form at [eventRegister.html](eventRegister.html) is wired in [`JS/script.js`](JS/script.js) (see `eventRegisterForm` handling).
  - Free events: the registration is recorded in Firestore.
  - Paid events: the form uses M-Pesa STK push flow and `startMpesaPayment` (frontend-to-cloud-function). On success, registration is recorded.
  - Helper functions:
    - [`getQueryParam`](JS/script.js) to read event ID from URL.
    - [`normalizeMpesaPhone`](JS/script.js) to normalize phone numbers.
    - [`uploadEventImage`](JS/script.js) used by add-event admin flow to upload images to Firebase Storage.
- Authentication:
  - All pages wired to Firebase Authentication via [`JS/firebaseConfig.js`](JS/firebaseConfig.js).
  - The create account, login, and password reset flows are implemented in `JS/script.js` and `JS/forgot.js`.

### Backend / Cloud Functions
- [`functions/index.js`](functions/index.js) includes:
  - `getAccessToken` helper to call M-Pesa OAuth.
  - `mpesaStkPush` function to call M-Pesa STK push API.
  - Callback handling to set `paymentStatus` on event registrations and store `mpesaReceiptNumber`, etc.
- The logic expects a securely configured Cloud Functions environment. See [Configuration](#firebase-functions-m-pesa-config).

---

## Important files & code references

- Frontend JS:
  - [`JS/script.js`](JS/script.js) — main UI logic and Firebase integration.
    - Notable symbols:
      - [`ADMIN_EMAILS`](JS/script.js) — simple admin list to toggle admin UI.
      - [`uploadEventImage`](JS/script.js) — image upload helper to Storage.
      - [`normalizeMpesaPhone`](JS/script.js) — validating phone numbers.
      - `loadEventsList`, `buildEventCard`, `openEventModal` — listing and modal logic.
      - Registration flow and UI helpers (forms and validation).
  - [`JS/firebaseConfig.js`](JS/firebaseConfig.js) — client Firebase initialization.
  - [`JS/index.js`](JS/index.js) — a Node example interacting with M-Pesa Daraja.
- Backend Cloud Functions:
  - [`functions/index.js`](functions/index.js) — Implements STK push and callback handling.
    - Notable functions:
      - `getAccessToken()` — OAuth token retrieval.
      - `extractCallbackMetadata()` — helper used in callback parsing.
      - STK push route: `exports.mpesaStkPush`.
- CSS & Pages:
  - [`css/styles.css`](css/styles.css) — main styles.
  - Pages: [`index.html`](index.html), [`EventsListView.html`](EventsListView.html), [`eventRegister.html`](eventRegister.html), [`addEvent.html`](addEvent.html), [`loginPage.html`](loginPage.html), [`registerPage.html`](registerPage.html), [`forgotPassword.html`](forgotPassword.html).

---

## Deployment instructions

### GitHub Pages
- Push the repository to GitHub (public).
- Enable GitHub Pages for the repository (branch: `gh-pages` or `main` root).
- This is an easy option for static pages; however Cloud Functions must be hosted with Firebase separately.

### Firebase Hosting + Functions
1. Install Firebase tools:
   ```bash
   npm i -g firebase-tools
   firebase login
   ```
2. Initialize (if not already):
   ```bash
   firebase init
   ```
   - Use Hosting + Functions; set `functions` dir as `functions/` and set `public` to the project root if you want to host static site together.
3. Configure environment secrets:
   ```bash
   firebase functions:config:set mpesa.consumer_key="..." mpesa.consumer_secret="..." mpesa.shortcode="..." mpesa.passkey="..."
   ```
4. Deploy:
   ```bash
   firebase deploy --only hosting,functions
   ```
   - After deployment, update the Cloud Function callback URL to use your function URL in [`JS/index.js`](JS/index.js) or your `functions/index.js` CallBackURL.

---

## Testing & Troubleshooting

- Logs and debugging:
  - Check browser console for front-end logs (see `console.log` messages scattered through `JS/script.js`).
  - For Firebase functions, inspect logs:
    ```bash
    firebase functions:log
    ```
- Common issues:
  - "Missing event ID" on registration — ensure URL contains `?id=<eventId>` (see `getQueryParam` in [`JS/script.js`](JS/script.js)).
  - CORS issues with Cloud Functions — ensure [`functions/index.js`](functions/index.js) `allowedOrigins` includes your site origin.
  - M-Pesa STK push in sandbox: configure correct sandbox credentials in `functions` and adjust the callback URL.

---

## Security & Production notes

- Never commit secrets (API keys, passkeys) to version control:
  - Move M-Pesa credentials out of `functions/index.js` to Firebase functions config (see [Configuration](#firebase-functions-m-pesa-config)).
  - Replace EmailJS keys or move them into environment secrets where appropriate.
- Validate & sanitize user input (forms).
- Add rate limiting or server-side checks if you accept user input or use payments at scale.
- Use HTTPS for all deployments.

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/<name>`.
3. Test changes locally, ensure UI and forms still work.
4. Submit a PR with an explanation and testing steps.

---

## License


---

## Where to look next (helpful links)

- [`JS/script.js`](JS/script.js) — Main JS logic (UI & Firebase).
- [`css/styles.css`](css/styles.css) — Styling & responsive notes.
- [`functions/index.js`](functions/index.js) — M-Pesa Cloud Function implementation.
- `JS/firebaseConfig.js` — Client Firebase initialization.
- Project pages: [`index.html`](index.html), [`EventsListView.html`](EventsListView.html), [`eventRegister.html`](eventRegister.html), [`addEvent.html`](addEvent.html), [`Gallery.html`](Gallery.html), [`contact.html`](contact.html), [`aboutPage.html`](aboutPage.html).
