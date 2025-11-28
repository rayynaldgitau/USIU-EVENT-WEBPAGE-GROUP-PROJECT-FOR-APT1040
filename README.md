# USIU Events Hub

USIU Events Hub is a web application that showcases upcoming and past events at United States International University–Africa (USIU-A).  
It was built as a final group project for the APT1040 Web Design course and demonstrates practical use of HTML, CSS, JavaScript, and Firebase to create a dynamic, accessible events platform.

---

## 🌐 Live Demo

GitHub Pages:  
https://rayynaldgitau.github.io/USIU-EVENT-WEBPAGE-GROUP-PROJECT-FOR-APT1040/

---

## 📋 Table of Contents

- [Project Overview](#project-overview)  
- [Key Features](#key-features)
  - [Student/User Features](#studentuser-features)
  - [Admin Features](#admin-features)
  - [UX & Accessibility](#ux--accessibility)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Clone the Repository](#clone-the-repository)
  - [Firebase Setup](#firebase-setup)
  - [Local Development](#local-development)
  - [Deployment](#deployment)
- [Data Model](#data-model)
- [Mpesa / Payments (Optional)](#mpesa--payments-optional)
- [Contributing](#contributing)
- [Team](#team)
- [License](#license)

---

## 🎯 Project Overview

USIU Events Hub centralizes university events into one responsive, easy-to-use web interface.  
The application allows students to:

- Discover upcoming academic, social, and club events.
- View detailed event information.
- Register for events online.
- Explore past events via a gallery.

Administrators can:

- Securely log in.
- Create and manage events.
- Upload event images.
- Monitor registrations.

The project also includes design artefacts such as wireframes, diagrams, and a logbook to document the development process.

---

## ⭐ Key Features

### Student/User Features

- **Home Page Dashboard**
  - Summary counts such as:
    - Upcoming Events
    - Registered Students
    - Events This Semester
  - Featured events section populated dynamically from Firebase.

- **Events List View**
  - List of all upcoming events.
  - Search and/or filter by title or other criteria.
  - Each event links to a detailed view.

- **Event Details Page**
  - Dedicated event page showing:
    - Title, date, time, and venue.
    - Event description.
    - Price (if applicable).
    - Event poster image.
  - Button to proceed to **Event Registration**.

- **Event Registration**
  - Registration form tied to a specific event.
  - Stores registration data in Firebase.
  - Designed to integrate with a payment flow (e.g., Mpesa) via a backend.

- **Gallery**
  - Displays images from past events.
  - Helps showcase campus life and previous activities.

- **Static Information Pages**
  - **About Page** – Describes the purpose of the platform.
  - **Contact Page** – Contact form and/or contact details.

---

### Admin Features

- **Authentication**
  - Login and registration pages for administrators.
  - Password reset (Forgot Password page).
  - Protected routes/pages using Firebase Authentication state.

- **Add Event Page**
  - Form to create new events with fields such as:
    - Title
    - Description
    - Date & Time
    - Location
    - Price / Free
    - Category / Type
  - Optional image upload (stored in Firebase Storage).

- **Event Management**
  - Events stored in Firestore, allowing:
    - Real-time updates to the events list.
    - Centralized management of event data.

---

### ♿ UX & Accessibility

- Semantic HTML structure (`<header>`, `<main>`, `<footer>`, etc.).
- **Skip to main content** link for keyboard and screen-reader users.
- Consistent navigation and layout across pages.
- Alt text for images where applicable.
- Focus on responsive design for different screen sizes.

---

## 🛠 Tech Stack

**Frontend**

- HTML5  
- CSS3  
- Vanilla JavaScript (ES Modules)

**Backend / Cloud Services**

- **Firebase**
  - Firebase Authentication (Email/Password)
  - Cloud Firestore (events & registrations data)
  - Firebase Storage (event images)
  - Firebase Hosting (optional, if used instead of GitHub Pages)

**Other**

- Git & GitHub for version control and collaboration.  
- GitHub Pages for static hosting.

---

## 📁 Project Structure

> This is a simplified overview; some files/folders may be omitted for brevity.

```text
USIU-EVENT-WEBPAGE-GROUP-PROJECT-FOR-APT1040/
├─ JS/
│  └─ script.js              # Core frontend logic (Firebase, auth, events)
├─ css/
│  └─ styles.css             # Global styles
├─ assets/
│  └─ ...                    # Images, icons, logos
├─ diagrams/
│  └─ ...                    # System diagrams / architecture
├─ wireframes/
│  └─ ...                    # Design wireframes
├─ logbook/
│  └─ ...                    # Development log / documentation
├─ evidence/
│  └─ ...                    # Screenshots, proof of work, etc.
├─ functions/                # (If used) Backend functions, e.g., Mpesa integration
├─ index.html                # Landing / Home page
├─ EventsListView.html       # Events list
├─ EventDetails.html         # Event details page
├─ eventRegister.html        # Event registration page
├─ Gallery.html              # Events gallery
├─ aboutPage.html            # About page
├─ contact.html              # Contact page
├─ loginPage.html            # Login
├─ registerPage.html         # Register
├─ forgotPassword.html       # Reset password
├─ addEvent.html             # Admin: Add event
├─ firebase.json             # Firebase project configuration
└─ README.md                 # Project documentation (this file)
