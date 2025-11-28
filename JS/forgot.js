// JS/forgot.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// ✅ Firebase config (same as other pages)
const firebaseConfig = {
  apiKey: "AIzaSyDrvrhISJEB_TmHm0GlqmpjvP1haFYFfVQ",
  authDomain: "usiueventswebpagebackend.firebaseapp.com",
  projectId: "usiueventswebpagebackend",
  storageBucket: "usiueventswebpagebackend.firebasestorage.app",
  messagingSenderId: "1070584142416",
  appId: "1:1070584142416:web:133d2ea364a5ab97d0cf55"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// status helper
function setStatus(el, msg, type = "info") {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("status-info", "status-success", "status-error");
  el.classList.add(`status-${type}`);
}

// friendlier Firebase error messages
function friendlyError(error) {
  if (!error?.code) return "Something went wrong.";
  switch (error.code) {
    case "auth/invalid-email":
      return "Invalid email format.";
    case "auth/user-not-found":
      return "No account found with that email.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return "Unable to send reset email. Try again.";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgot-form");
  const statusEl = document.getElementById("auth-status-forgot");
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const email = form.email.value.trim();
    if (!email) {
      setStatus(statusEl, "Please enter your email.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");
    setStatus(statusEl, "Sending password reset email…", "info");

    try {
      await sendPasswordResetEmail(auth, email);
      setStatus(
        statusEl,
        "If this email is registered, a reset link has been sent. Please check your inbox.",
        "success"
      );
    } catch (err) {
      console.error(err);
      setStatus(statusEl, friendlyError(err), "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
    }
  });

  // Optional: redirect logged-in users
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // window.location.href = "index.html";
    }
  });
});
