const form = document.querySelector("form[data-enhanced='true']");
if (form) {
  const status = document.getElementById("form-status");

  const showHint = (input) => {
    const id = input.id || input.name;
    let hint = document.querySelector(`[data-hint-for='${id}']`);
    if (!hint) return;
    hint.textContent = input.validationMessage;
    hint.hidden = input.checkValidity();
  };

  form.addEventListener(
    "invalid",
    (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        showHint(t);
      }
    },
    true
  );

  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
      showHint(t);
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (form.checkValidity()) {
      if (status) status.textContent = "Form ready. This is a demo; no backend submission.";
    } else {
      const inputs = form.querySelectorAll("input, textarea");
      inputs.forEach((i) => showHint(i));
      if (status) status.textContent = "Please fix the validation errors.";
    }
  });

}

// Firebase Imports 
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";


//  Firebase Config 
const firebaseConfig = {
  apiKey: "AIzaSyDrvrhISJEB_TmHm0GlqmpjvP1haFYFfVQ",
  authDomain: "usiueventswebpagebackend.firebaseapp.com",
  projectId: "usiueventswebpagebackend",
  storageBucket: "usiueventswebpagebackend.firebasestorage.app",
  messagingSenderId: "1070584142416",
  appId: "1:1070584142416:web:133d2ea364a5ab97d0cf55",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);


//  Helper Functions 
function showStatus(el, msg, type = "info") {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("status-info", "status-success", "status-error");
  el.classList.add(`status-${type}`);
}

function friendlyError(error) {
  if (!error?.code) return "Something went wrong.";

  switch (error.code) {
    case "auth/invalid-email": return "Invalid email format.";
    case "auth/email-already-in-use": return "Email already registered.";
    case "auth/weak-password": return "Password must be at least 6 characters.";
    case "auth/user-not-found": return "No account found with that email.";
    case "auth/wrong-password": return "Wrong password.";
    case "auth/too-many-requests": return "Too many attempts. Try again later.";
    default: return "Unable to process request.";
  }
}

// Show/Hide password toggles
function setupPasswordToggles() {
  const toggles = document.querySelectorAll("[data-toggle-password]");
  toggles.forEach(btn => {
    const targetId = btn.getAttribute("data-toggle-password");
    const input = document.getElementById(targetId);

    if (!input) return;

    btn.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.textContent = isHidden ? "Hide" : "Show";
    });
  });
}

// // Profile picture upload
// async function uploadProfilePicture(file, uid) {
//   if (!file || !uid) return null;
//   const fileRef = ref(storage, `profile-pictures/${uid}-${file.name}`);
//   await uploadBytes(fileRef, file);
//   return await getDownloadURL(fileRef);
// }

// Logout logic for any button with [data-logout]
function setupLogoutButtons() {
  const logoutBtns = document.querySelectorAll("[data-logout]");
  logoutBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "loginPage.html";
    });
  });
}


// Main Logic (runs on every page) 
window.addEventListener("DOMContentLoaded", () => {
  setupPasswordToggles();
  setupLogoutButtons();



  // LOGIN FORM LOGIC

  const loginForm = document.getElementById("login-form");
  const loginStatus = document.getElementById("auth-status-login");

  if (loginForm) {
    const submitBtn = loginForm.querySelector("button[type='submit']");

    loginForm.addEventListener("submit", async e => {
      e.preventDefault();

      if (!loginForm.reportValidity()) return;

      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      showStatus(loginStatus, "Signing you in…", "info");

      try {
        await signInWithEmailAndPassword(auth, email, password);
        showStatus(loginStatus, "Success! Redirecting…", "success");

        setTimeout(() => window.location.href = "index.html", 800);
      } catch (err) {
        console.error(err);
        showStatus(loginStatus, friendlyError(err), "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
      }
    });
  }

  // REGISTRATION FORM LOGIC
 
  const registerForm = document.getElementById("register-form");
  const registerStatus = document.getElementById("auth-status-register");

  if (registerForm) {
    const submitBtn = registerForm.querySelector("button[type='submit']");

    registerForm.addEventListener("submit", async e => {
      e.preventDefault();

      if (!registerForm.reportValidity()) return;

      const firstName = registerForm.firstName.value.trim();
      const lastName = registerForm.lastName.value.trim();
      const email = registerForm.email.value.trim();
      const password = registerForm.password.value;
      const confirmPassword = registerForm.confirmPassword.value;
      const terms = document.getElementById("reg-terms");

      const photoInput = document.getElementById("reg-photo");

      if (!terms?.checked) {
        return showStatus(registerStatus, "You must accept the terms.", "error");
      }
      if (password !== confirmPassword) {
        return showStatus(registerStatus, "Passwords do not match.", "error");
      }

      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      showStatus(registerStatus, "Creating your account…", "info");

      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCred.user;

        // // Upload profile picture (optional)
        // let photoURL = null;
        // if (photoInput?.files[0]) {
        //   try {
        //     photoURL = await uploadProfilePicture(photoInput.files[0], user.uid);
        //   } catch (err) {
        //     console.error("Profile upload error:", err);
        //   }
        // }

        // Update profile
        await updateProfile(user, {
          displayName: `${firstName} ${lastName}`,
          photoURL: photoURL || null,
        });

        showStatus(registerStatus, "Account created! Redirecting…", "success");
        setTimeout(() => window.location.href = "index.html", 1200);

      } catch (err) {
        console.error(err);
        showStatus(registerStatus, friendlyError(err), "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
      }
    });
  }


  // FORGOT PASSWORD PAGE LOGIC

  const forgotForm = document.getElementById("forgot-form");
  const forgotStatus = document.getElementById("auth-status-forgot");

  if (forgotForm) {
    const submitBtn = forgotForm.querySelector("button[type='submit']");

    forgotForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (!forgotForm.reportValidity()) return;

      const email = forgotForm.email.value.trim();

      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      showStatus(forgotStatus, "Sending reset email…", "info");

      try {
        await sendPasswordResetEmail(auth, email);
        showStatus(forgotStatus, "Reset link sent! Check your inbox.", "success");
      } catch (err) {
        console.error(err);
        showStatus(forgotStatus, friendlyError(err), "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
      }
    });
  }


  // SHOW/HIDE LOGIN–LOGOUT IN NAVBAR

  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");

  onAuthStateChanged(auth, (user) => {
    if (loginLink && logoutBtn) {
      if (user) {
        loginLink.style.display = "none";
        logoutBtn.style.display = "inline-block";
      } else {
        loginLink.style.display = "inline-block";
        logoutBtn.style.display = "none";
      }
    }

    // Route protection
    const body = document.body;
    const isProtected = body.dataset.protected === "true";
    const isAuthPage = body.dataset.authPage === "login" ||
                       body.dataset.authPage === "register" ||
                       body.dataset.authPage === "forgot";

    if (isProtected && !user) {
      window.location.href = "loginPage.html";
    }

    if (isAuthPage && user) {
      window.location.href = "index.html";
    }
  });
});

// for the navigation menu toggle
// MOBILE NAV TOGGLE
const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.getElementById('primary-nav');

if (menuToggle && primaryNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = primaryNav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}
