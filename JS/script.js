function normalizeMpesaPhone(raw) {
  const digits = raw.replace(/\D/g, ""); // remove spaces, +, etc.

  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    // 07xx -> 2547xx
    return "254" + digits.slice(1);
  }

  if (digits.startsWith("7") && digits.length === 9) {
    return "254" + digits;
  }

  throw new Error("Invalid M-Pesa phone number format.");
}
async function startMpesaPayment({ amount, phone, eventId, eventTitle, ticketCode }) {
  const normalizedPhone = normalizeMpesaPhone(phone);

  const res = await fetch(
    "https://us-central1-usiueventswebpagebackend.cloudfunctions.net/mpesaStkPush", // your function URL
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: normalizedPhone,
        amount,
        accountReference: ticketCode || eventId,
        description: eventTitle || "USIU Event Ticket",
      }),
    }
  );

  const data = await res.json();

  if (!res.ok || !data.success) {
    console.error("M-Pesa error:", data);
    throw new Error(
      data.error || "Could not start M-Pesa payment. Please try again."
    );
  }

  return data.data; // MerchantRequestID, CheckoutRequestID, CustomerMessage...
}


// EMAILJS TICKET SENDER (front-end email sending)
function sendTicketEmailWithEmailJS({ name, email, ev, ticketCode }) {
  // Make sure EmailJS is loaded
  if (typeof emailjs === "undefined") {
    console.warn("EmailJS SDK not loaded; skipping ticket email.");
    return Promise.resolve();
  }

  // Configure your EmailJS service/template/public key here
  const SERVICE_ID = "service_03hfprr";
  const TEMPLATE_ID = "template_2csh4gj";
  const PUBLIC_KEY = "ZPs-uhpAwpEvsD2rx";

  try {
    emailjs.init(PUBLIC_KEY);
  } catch (e) {
    // init might have been called before; safe to ignore
  }

  const templateParams = {
    to_name: name,
    to_email: email,
    event_title: ev.title || "USIU Event",
    event_date: ev.date || "",
    event_time: ev.time || "",
    event_location: ev.location || "",
    ticket_code: ticketCode,
    amount: ev.isFree ? "Free" : `KES ${ev.price ?? 0}`,
  };

  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
}

// FORM ENHANCER FOR CONTACT / GENERIC FORMS

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
      if (status)
        status.textContent =
          "Form ready. This is a demo; no backend submission.";
    } else {
      const inputs = form.querySelectorAll("input, textarea");
      inputs.forEach((i) => showHint(i));
      if (status) status.textContent = "Please fix the validation errors.";
    }
  });
}

// FIREBASE IMPORTS (USING SEPARATE CONFIG FILE)

import { auth, storage, db } from "./firebaseConfig.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Simple admin list by email
const ADMIN_EMAILS = ["admin@usiu.ac.ke"];

// HELPER FUNCTIONS

function showStatus(el, msg, type = "info") {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("status-info", "status-success", "status-error");
  el.classList.add(`status-${type}`);
}

function friendlyError(error) {
  if (!error?.code) return "Something went wrong.";

  switch (error.code) {
    case "auth/invalid-email":
      return "Invalid email format.";
    case "auth/email-already-in-use":
      return "Email already registered.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-not-found":
      return "No account found with that email.";
    case "auth/wrong-password":
      return "Wrong password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return "Unable to process request.";
  }
}

// Show/Hide password toggles
function setupPasswordToggles() {
  const toggles = document.querySelectorAll("[data-toggle-password]");
  toggles.forEach((checkbox) => {
    const targetIds = checkbox.getAttribute("data-toggle-password");
    const inputIds = targetIds.split(",").map(id => id.trim());
    const inputs = inputIds.map(id => document.getElementById(id)).filter(Boolean);

    if (inputs.length === 0) return;

    checkbox.addEventListener("change", () => {
      inputs.forEach(input => {
        input.type = checkbox.checked ? "text" : "password";
      });
    });
  });
}

// Logout logic for any button with [data-logout]
function setupLogoutButtons() {
  const logoutBtns = document.querySelectorAll("[data-logout]");
  logoutBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        console.log("Logout clicked");
        await signOut(auth);
        console.log("Sign-out successful");
      } catch (err) {
        console.error("Error during sign-out:", err);
      } finally {
        window.location.href = "loginPage.html";
      }
    });
  });
}

// Upload event image to Storage (NO compression)
async function uploadEventImage(file, eventId) {
  const fileRef = ref(storage, `event-images/${eventId}-${file.name}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

// Get query parameter (for eventRegister.html?id=...)
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// MAIN LOGIC

window.addEventListener("DOMContentLoaded", () => {
  setupPasswordToggles();
  setupLogoutButtons();

  const body = document.body;
  const page = body.dataset.page || "";

  // LOGIN FORM LOGIC

  const loginForm = document.getElementById("login-form");
  const loginStatus = document.getElementById("auth-status-login");

  if (loginForm) {
    const submitBtn = loginForm.querySelector("button[type='submit']");

    loginForm.addEventListener("submit", async (e) => {
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

        setTimeout(() => (window.location.href = "index.html"), 800);
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

    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!registerForm.reportValidity()) return;

      const firstName = registerForm.firstName.value.trim();
      const lastName = registerForm.lastName.value.trim();
      const email = registerForm.email.value.trim();
      const password = registerForm.password.value;
      const confirmPassword = registerForm.confirmPassword.value;
      const terms = document.getElementById("reg-terms");

      if (!terms?.checked) {
        return showStatus(
          registerStatus,
          "You must accept the terms.",
          "error"
        );
      }
      if (password !== confirmPassword) {
        return showStatus(registerStatus, "Passwords do not match.", "error");
      }

      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      showStatus(registerStatus, "Creating your account…", "info");

      try {
        const userCred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCred.user;

        await updateProfile(user, {
          displayName: `${firstName} ${lastName}`,
        });

        showStatus(registerStatus, "Account created! Redirecting…", "success");
        setTimeout(() => (window.location.href = "index.html"), 1200);
      } catch (err) {
        console.error(err);
        showStatus(registerStatus, friendlyError(err), "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
      }
    });
  }

  // FORGOT PASSWORD

  const forgotForm = document.getElementById("forgot-form");
  const forgotStatus = document.getElementById("auth-status-forgot");

  if (forgotForm) {
    const submitBtn = forgotForm.querySelector("button[type='submit']");

    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!forgotForm.reportValidity()) return;

      const email = forgotForm.email.value.trim();
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      showStatus(forgotStatus, "Sending reset email…", "info");

      try {
        await sendPasswordResetEmail(auth, email);
        showStatus(
          forgotStatus,
          "Reset link sent! Check your inbox.",
          "success"
        );
      } catch (err) {
        console.error(err);
        showStatus(forgotStatus, friendlyError(err), "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
      }
    });
  }

  // ADD EVENT PAGE LOGIC

  const addEventForm = document.getElementById("add-event-form");
  const addEventStatus = document.getElementById("auth-status-add-event");

  if (addEventForm) {
    const priceInput = document.getElementById("event-price");
    const freeRadios = addEventForm.elements["isFree"];
    const imageInput = document.getElementById("event-image");

    // Free/Paid toggle for price input
    if (freeRadios) {
      [...freeRadios].forEach((r) => {
        r.addEventListener("change", () => {
          if (r.value === "false" && r.checked) {
            priceInput.disabled = false;
          } else if (r.value === "true" && r.checked) {
            priceInput.disabled = true;
            priceInput.value = "";
          }
        });
      });
    }

    addEventForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!addEventForm.reportValidity()) return;

      const title = addEventForm.title.value.trim();
      const description = addEventForm.description.value.trim();
      const date = addEventForm.date.value;
      const time = addEventForm.time.value;
      const location = addEventForm.location.value.trim();
      const category = addEventForm.category.value;
      const isFree = addEventForm.isFree.value === "true";
      const price = isFree ? 0 : Number(addEventForm.price.value || 0);
      const file = imageInput?.files?.[0];

      if (!file) {
        return showStatus(addEventStatus, "Please select an image.", "error");
      }

      // 1 MB limit (1 * 1024 * 1024 bytes)
      const MAX_SIZE_BYTES = 1 * 1024 * 1024;

      if (file.size > MAX_SIZE_BYTES) {
        const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
        return showStatus(
          addEventStatus,
          `Image is too large (${sizeInMb} MB). Max allowed size is 1 MB.`,
          "error"
        );
      }
      showStatus(addEventStatus, "Creating event…", "info");

      try {
        // Step 1: create event document without imageUrl
        const docRef = await addDoc(collection(db, "events"), {
          title,
          description,
          date,
          time,
          location,
          category,
          isFree,
          price,
          createdAt: serverTimestamp(),
        });

        // Step 2: upload image and update event
        const imageUrl = await uploadEventImage(file, docRef.id);
        await updateDoc(doc(db, "events", docRef.id), { imageUrl });

        showStatus(addEventStatus, "Event created successfully!", "success");
        addEventForm.reset();
        if (priceInput) priceInput.disabled = true;
      } catch (err) {
        console.error("Add event error:", err.code, err.message, err);
        showStatus(addEventStatus, "Failed to create event.", "error");
      }
    });
  }

    // ======================
  // Event details modal
  // ======================

  const eventModal = document.getElementById("event-modal");
  const eventModalImage = document.getElementById("event-modal-image");
  const eventModalTitle = document.getElementById("event-modal-title");
  const eventModalCategory = document.getElementById("event-modal-category");
  const eventModalMeta = document.getElementById("event-modal-meta");
  const eventModalDesc = document.getElementById("event-modal-desc");
  const eventModalPrice = document.getElementById("event-modal-price");
  const eventModalClose = document.getElementById("event-modal-close");
  const eventModalCloseSecondary = document.getElementById(
    "event-modal-close-secondary"
  );
  const eventModalRegisterBtn = document.getElementById(
    "event-modal-register-btn"
  );

  let currentModalEventId = null;

  function openEventModal(ev) {
    if (!eventModal) return;

    currentModalEventId = ev.id;

    if (eventModalTitle)
      eventModalTitle.textContent = ev.title || "Event details";
    if (eventModalCategory)
      eventModalCategory.textContent = ev.category || "General";
    if (eventModalMeta)
      eventModalMeta.textContent = `${ev.date || ""} • ${ev.time || ""} • ${
        ev.location || ""
      }`;
    if (eventModalDesc)
      eventModalDesc.textContent =
        ev.description || "No additional description provided.";
    if (eventModalPrice)
      eventModalPrice.textContent = ev.isFree
        ? "Free"
        : `KES ${ev.price != null ? ev.price : 0}`;

    if (eventModalImage) {
      if (ev.imageUrl) {
        eventModalImage.style.backgroundImage = `url("${ev.imageUrl}")`;
      } else {
        eventModalImage.style.backgroundImage = "";
      }
    }

    if (eventModalRegisterBtn) {
      eventModalRegisterBtn.onclick = () => {
        if (!currentModalEventId) return;
        window.location.href = `eventRegister.html?id=${currentModalEventId}`;
      };
    }

    eventModal.classList.add("is-open");
    eventModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeEventModal() {
    if (!eventModal) return;
    eventModal.classList.remove("is-open");
    eventModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentModalEventId = null;
  }

  if (eventModal) {
    // Clicking backdrop closes
    eventModal.addEventListener("click", (e) => {
      if (e.target === eventModal) {
        closeEventModal();
      }
    });
  }

  if (eventModalClose) {
    eventModalClose.addEventListener("click", closeEventModal);
  }
  if (eventModalCloseSecondary) {
    eventModalCloseSecondary.addEventListener("click", closeEventModal);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeEventModal();
    }
  });




  // EVENTS LIST PAGE (EventsListView.html)

  const eventsList = document.getElementById("events-list");
  const filterButtons = document.querySelectorAll(".filter-chip");
  const searchInput = document.getElementById("events-search-input");
  const eventsCountEl = document.getElementById("events-count");

  // Will hold all events from Firestore so we can filter/search on the client
  let allEvents = [];

  function getActiveCategory() {
    const active = document.querySelector(".filter-chip.is-active");
    return active ? active.dataset.filter || "all" : "all";
  }

  function updateEventCount(visible, total) {
    if (!eventsCountEl) return;
    if (total != null && total !== visible) {
      eventsCountEl.textContent = `Showing ${visible} of ${total} events`;
    } else {
      const label = visible === 1 ? "event" : "events";
      eventsCountEl.textContent = `Showing ${visible} ${label}`;
    }
  }

  // Build one event card (structure matches the CSS you are using)
  function buildEventCard(ev) {
    const article = document.createElement("article");
    article.className = "event-card";

    const thumb = document.createElement("div");
    thumb.className = "event-thumb";
    if (ev.imageUrl) {
      const img = document.createElement("img");
      img.src = ev.imageUrl;
      img.alt = ev.title || "Event image";
      thumb.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "event-card-body";

    const header = document.createElement("div");
    header.className = "event-card-header";

    const categoryBadge = document.createElement("span");
    categoryBadge.className = "event-category";
    categoryBadge.textContent = ev.category || "General";

    const titleEl = document.createElement("h3");
    titleEl.textContent = ev.title || "Untitled event";

    header.appendChild(categoryBadge);
    header.appendChild(titleEl);

    const metaList = document.createElement("ul");
    metaList.className = "event-meta-list";

    const dateLi = document.createElement("li");
    dateLi.textContent = ev.date || "";
    metaList.appendChild(dateLi);

    const timeLi = document.createElement("li");
    timeLi.textContent = ev.time || "";
    metaList.appendChild(timeLi);

    const locLi = document.createElement("li");
    locLi.textContent = ev.location || "";
    metaList.appendChild(locLi);

    const desc = document.createElement("p");
    desc.className = "event-description";
    desc.textContent = ev.description || "";

    const price = document.createElement("p");
    price.className = "event-price";
    price.textContent = ev.isFree
      ? "Free"
      : `Paid — KES ${ev.price != null ? ev.price : 0}`;

    const actions = document.createElement("div");
    actions.className = "event-actions";

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "btn-outline";
    viewBtn.textContent = "View Details";
    viewBtn.addEventListener("click", () => openEventModal(ev));

    const registerBtn = document.createElement("button");
    registerBtn.type = "button";
    registerBtn.className = "btn-primary event-register-btn";
    registerBtn.dataset.eventId = ev.id;
    registerBtn.textContent = "Register";
    registerBtn.addEventListener("click", () => {
      window.location.href = `eventRegister.html?id=${ev.id}`;
    });

    actions.appendChild(viewBtn);
    actions.appendChild(registerBtn);

    body.appendChild(header);
    body.appendChild(metaList);
    body.appendChild(desc);
    body.appendChild(price);
    body.appendChild(actions);

    article.appendChild(thumb);
    article.appendChild(body);

    return article;
  }


  // Render a list of events (after filtering/searching)
  function renderEvents(events) {
    if (!eventsList) return;

    if (!events.length) {
      eventsList.innerHTML = "<p>No matching events.</p>";
      return;
    }

    eventsList.innerHTML = "";
    events.forEach((ev) => {
      const card = buildEventCard(ev);
      eventsList.appendChild(card);
    });
  }

  // Apply category + search filters on top of allEvents
  function applyEventFilters() {
    if (!eventsList) return;

    if (!allEvents.length) {
      eventsList.innerHTML = "<p>No events yet.</p>";
      updateEventCount(0, 0);
      return;
    }

    const activeCategory = getActiveCategory(); // "all", "Academic", ...
    const searchTerm = (searchInput?.value || "").trim().toLowerCase();

    let filtered = allEvents.slice();

    // Category filter
    if (activeCategory && activeCategory.toLowerCase() !== "all") {
      filtered = filtered.filter((ev) =>
        (ev.category || "General").toLowerCase() ===
        activeCategory.toLowerCase()
      );
    }

    // Search filter (title, description, location)
    if (searchTerm) {
      filtered = filtered.filter((ev) => {
        const title = (ev.title || "").toLowerCase();
        const desc = (ev.description || "").toLowerCase();
        const loc = (ev.location || "").toLowerCase();
        return (
          title.includes(searchTerm) ||
          desc.includes(searchTerm) ||
          loc.includes(searchTerm)
        );
      });
    }

    renderEvents(filtered);
    updateEventCount(filtered.length, allEvents.length);
  }

  // Load from Firestore once, store in allEvents, then filter in the client
  async function loadEventsList() {
    if (!eventsList) return;

    eventsList.innerHTML = "<p>Loading events…</p>";
    if (eventsCountEl) eventsCountEl.textContent = "";

    try {
      const qEvents = query(
        collection(db, "events"),
        orderBy("date", "asc"),
        orderBy("time", "asc")
      );
      const snapshot = await getDocs(qEvents);

      if (snapshot.empty) {
        allEvents = [];
        eventsList.innerHTML = "<p>No events yet.</p>";
        updateEventCount(0, 0);
        return;
      }

      // Convert snapshot to a plain array we can work with
      allEvents = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      applyEventFilters();
    } catch (err) {
      console.error("Load events error:", err);
      eventsList.innerHTML = "<p>Failed to load events.</p>";
      updateEventCount(0, 0);
    }
  }

  if (eventsList) {
    // Initial load from Firestore
    loadEventsList();

    // Category chips
    if (filterButtons.length) {
      filterButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          filterButtons.forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          applyEventFilters();
        });
      });
    }

    // Search bar
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        applyEventFilters();
      });
    }
  }


  // EVENT REGISTER PAGE

  const eventRegisterForm = document.getElementById("event-register-form");
  const eventRegisterStatus = document.getElementById(
    "auth-status-register-event"
  );

  if (eventRegisterForm) {
    (async () => {
      const eventId = getQueryParam("id");
      if (!eventId) {
        showStatus(eventRegisterStatus, "Missing event ID.", "error");
        return;
      }

      const eventTitleEl = document.getElementById("event-title-display");
      const eventMetaEl = document.getElementById("event-meta-display");
      const paymentSection = document.getElementById("payment-section");

      const summaryTitleFallback = document.getElementById(
        "summary-title-fallback"
      );
      const summaryMetaEl = document.getElementById("summary-meta");
      const summaryLocationEl = document.getElementById("summary-location");
      const summaryPriceEl = document.getElementById("summary-price");

      let ev = null;

      try {
        const snap = await getDoc(doc(db, "events", eventId));
        if (!snap.exists()) {
          showStatus(eventRegisterStatus, "Event not found.", "error");
          return;
        }

        ev = snap.data();

        const metaText = `${ev.date || ""} • ${ev.time || ""} • ${
          ev.location || ""
        }`;

        if (eventTitleEl)
          eventTitleEl.textContent = ev.title || "Register for event";
        if (eventMetaEl) eventMetaEl.textContent = metaText;

        if (summaryTitleFallback)
          summaryTitleFallback.textContent = ev.title || "Event";
        if (summaryMetaEl)
          summaryMetaEl.textContent = `${ev.date || ""} • ${ev.time || ""}`;
        if (summaryLocationEl)
          summaryLocationEl.textContent = ev.location || "TBA";
        if (summaryPriceEl) {
          summaryPriceEl.textContent = ev.isFree
            ? "Free"
            : `KES ${ev.price != null ? ev.price : 0}`;
        }

        // Build payment section
        if (paymentSection) {
          if (ev.isFree) {
            paymentSection.innerHTML = `
              <div class="payment-card is-free">
                <h3>This event is FREE</h3>
                <p>No payment is required. Just confirm your registration.</p>
              </div>
            `;
          } else {
            const amount = ev.price != null ? ev.price : 0;
            paymentSection.innerHTML = `
              <div class="payment-card">
                <div class="payment-header">
                  <h3>M-Pesa Payment</h3>
                  <p>Amount to pay: <strong>KES ${amount}</strong></p>
                </div>
                <div class="payment-body">
                  <label class="form-field">
                    <span>M-Pesa Phone Number</span>
                    <input
                      type="tel"
                      name="mpesaPhone"
                      id="mpesa-phone"
                      placeholder="07XXXXXXXX"
                      required
                    />
                  </label>
                  <label class="form-field">
                    <span>M-Pesa Transaction Code (optional)</span>
                    <input
                      type="text"
                      name="mpesaCode"
                      id="mpesa-code"
                      placeholder="e.g. QJK123456X"
                    />
                  </label>
                  <p class="payment-hint">
                    This demo does <strong>not</strong> trigger a real M-Pesa STK push.
                    In production, you would call a secure backend API here to start
                    the payment and confirm the transaction.
                  </p>
                </div>
              </div>
            `;
          }
        }

// Handle submit
eventRegisterForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!eventRegisterForm.reportValidity()) return;

  const name = eventRegisterForm.name.value.trim();
  const email = eventRegisterForm.email.value.trim();
  const phone = eventRegisterForm.phone.value.trim();
  const notes = (eventRegisterForm.notes?.value || "").trim();

  if (!ev) {
    showStatus(
      eventRegisterStatus,
      "Event details not loaded.",
      "error"
    );
    return;
  }

  let mpesaPhone = "";
  let mpesaCode = "";
  let checkoutRequestId = null;

  const amount = ev.price != null ? ev.price : 0;

  if (!ev.isFree) {
    mpesaPhone = (eventRegisterForm.mpesaPhone?.value || "").trim();
    mpesaCode = (eventRegisterForm.mpesaCode?.value || "").trim();

    if (!mpesaPhone) {
      showStatus(
        eventRegisterStatus,
        "Please enter your M-Pesa phone number.",
        "error"
      );
      return;
    }
  }

  // Basic ticket code – you can customize if you like
  const ticketCode = `USIU-${eventId
    .slice(0, 4)
    .toUpperCase()}-${Date.now().toString().slice(-4)}`;

  // ---------- 1) Try to start M-Pesa (only for paid events) ----------
  if (!ev.isFree) {
    try {
      showStatus(
        eventRegisterStatus,
        "Sending M-Pesa STK push to your phone…",
        "info"
      );

      const stkData = await startMpesaPayment({
        amount,
        phone: mpesaPhone,
        eventId,
        eventTitle: ev.title || "USIU Event",
        ticketCode,
      });

      console.log("STK push started:", stkData);
      checkoutRequestId = stkData.CheckoutRequestID || null;
    } catch (mpesaErr) {
      console.error("M-Pesa start error:", mpesaErr);

      // Do NOT block registration anymore
      showStatus(
        eventRegisterStatus,
        "M-Pesa sandbox is not responding. " +
          "We will still record your registration as UNPAID (demo).",
        "warning"
      );
    }
  } else {
    showStatus(
      eventRegisterStatus,
      "Submitting your registration…",
      "info"
    );
  }

  // ---------- 2) Save registration in Firestore (always) ----------
  try {
    const paymentStatus = ev.isFree
      ? "not_required"
      : checkoutRequestId
      ? "pending"
      : "mpesa_error";

    await addDoc(collection(db, "eventRegistrations"), {
      eventId,
      eventTitle: ev.title || "",
      name,
      email,
      phone,
      notes,
      mpesaPhone,
      mpesaCode,
      amount,
      isFree: !!ev.isFree,
      ticketCode,
      checkoutRequestId: checkoutRequestId,
      createdAt: serverTimestamp(),
      paymentStatus,
    });

    // ---------- 3) Send ticket email ----------
    try {
      await sendTicketEmailWithEmailJS({
        name,
        email,
        ev,
        ticketCode,
      });
    } catch (emailErr) {
      console.error("Ticket email send error:", emailErr);
      // do not fail the whole flow if email fails
    }

    // ---------- 4) Final UI message ----------
    if (ev.isFree) {
      showStatus(
        eventRegisterStatus,
        "Registration complete! A ticket has been emailed to you.",
        "success"
      );
    } else if (checkoutRequestId) {
      showStatus(
        eventRegisterStatus,
        "Registration recorded. STK push sent (sandbox). " +
          "Check your phone, enter your M-Pesa PIN, and keep the SMS as proof. " +
          "A ticket has been emailed to you.",
        "success"
      );
    } else {
      showStatus(
        eventRegisterStatus,
        "Registration recorded as UNPAID (M-Pesa demo / error). " +
          "This is a sandbox demo – no real money was charged. " +
          "A ticket has been emailed to you.",
        "success"
      );
    }

    eventRegisterForm.reset();
  } catch (err) {
    console.error("Registration save error:", err);
    showStatus(
      eventRegisterStatus,
      "Could not save registration. Please try again.",
      "error"
    );
  }
});

      } catch (err) {
        console.error("Event load error:", err);
        showStatus(
          eventRegisterStatus,
          "Could not load event details.",
          "error"
        );
      }
    })();
  }


    // =========================
  // HOME PAGE (index.html)
  // =========================

  const homeFeaturedGrid = document.getElementById("home-featured-grid");
  const homeSearchInput = document.getElementById("home-search-input");

  const upcomingStatEl = document.getElementById("stat-upcoming-events");
  const registeredStatEl = document.getElementById("stat-registered-students");
  const semesterStatEl = document.getElementById("stat-events-semester");

  // Will hold all events for the home page
  let homeAllEvents = [];

  // Render cards into the "Featured Events" grid
  function renderHomeEvents(events) {
    if (!homeFeaturedGrid) return;

    homeFeaturedGrid.innerHTML = "";

    if (!events.length) {
      homeFeaturedGrid.innerHTML = "<p>No events to display.</p>";
      return;
    }

    const toShow = events.slice(0, 4); // show up to 4 featured events

    toShow.forEach((ev) => {
      const article = document.createElement("article");
      article.className = "event-card";

      const imgDiv = document.createElement("div");
      imgDiv.className = "event-image";
      imgDiv.setAttribute("role", "img");
      imgDiv.setAttribute("aria-label", ev.title || "Event image");
      if (ev.imageUrl) {
        imgDiv.style.backgroundImage = `url("${ev.imageUrl}")`;
        imgDiv.style.backgroundSize = "cover";
        imgDiv.style.backgroundPosition = "center";
      }

      const contentDiv = document.createElement("div");
      contentDiv.className = "event-content";

      const titleEl = document.createElement("h4");
      titleEl.textContent = ev.title || "Untitled event";

      const metaUl = document.createElement("ul");
      metaUl.className = "event-meta";

      const liDate = document.createElement("li");
      liDate.innerHTML = `<img src="./assets/icons/calendar icon.svg" alt=""> ${
        ev.date || ""
      }`;

      const liTime = document.createElement("li");
      liTime.innerHTML = `<img src="./assets/icons/time icon.svg" alt=""> ${
        ev.time || ""
      }`;

      const liLoc = document.createElement("li");
      liLoc.innerHTML = `<img src="./assets/icons/location icon.svg" alt=""> ${
        ev.location || ""
      }`;

      metaUl.appendChild(liDate);
      metaUl.appendChild(liTime);
      metaUl.appendChild(liLoc);

      // Actions row
      const actionsRow = document.createElement("div");
      actionsRow.className = "event-actions";

      const detailsBtn = document.createElement("button");
      detailsBtn.type = "button";
      detailsBtn.className = "btn-outline";
      detailsBtn.textContent = "View Details";
      detailsBtn.addEventListener("click", () => openEventModal(ev));

      const registerBtn = document.createElement("button");
      registerBtn.type = "button";
      registerBtn.className = "btn-primary";
      registerBtn.textContent = "Register";
      registerBtn.addEventListener("click", () => {
        window.location.href = `eventRegister.html?id=${ev.id}`;
      });

      actionsRow.appendChild(detailsBtn);
      actionsRow.appendChild(registerBtn);

      contentDiv.appendChild(titleEl);
      contentDiv.appendChild(metaUl);
      contentDiv.appendChild(actionsRow);

      article.appendChild(imgDiv);
      article.appendChild(contentDiv);

      homeFeaturedGrid.appendChild(article);
    });
  }


  // Update stats based on events and registrations
  function updateHomeStatsFromEvents(events) {
    const today = new Date();
    let upcomingCount = 0;

    events.forEach((ev) => {
      if (!ev.date) return;
      const d = new Date(ev.date);
      if (!isNaN(d) && d >= new Date(today.toDateString())) {
        upcomingCount += 1;
      }
    });

    if (upcomingStatEl) {
      upcomingStatEl.textContent = upcomingCount.toString();
    }

    // For "Events This Semester" we'll use total events for now
    if (semesterStatEl) {
      semesterStatEl.textContent = events.length.toString();
    }
  }

  async function loadRegisteredStudentsCount() {
    if (!registeredStatEl) return;
    try {
      const regsSnap = await getDocs(collection(db, "eventRegistrations"));
      registeredStatEl.textContent = regsSnap.size.toString();
    } catch (err) {
      console.error("Failed to load registrations count:", err);
    }
  }

  function applyHomeSearchFilter() {
    if (!homeAllEvents.length || !homeFeaturedGrid) return;

    const term = (homeSearchInput?.value || "").trim().toLowerCase();
    let filtered = homeAllEvents;

    if (term) {
      filtered = homeAllEvents.filter((ev) => {
        const title = (ev.title || "").toLowerCase();
        const desc = (ev.description || "").toLowerCase();
        const loc = (ev.location || "").toLowerCase();
        return (
          title.includes(term) || desc.includes(term) || loc.includes(term)
        );
      });
    }

    renderHomeEvents(filtered);
  }

  // Load events for home page
  async function loadHomePageData() {
    if (!homeFeaturedGrid) return; // not on home page

    try {
      const qEvents = query(
        collection(db, "events"),
        orderBy("date", "asc"),
        orderBy("time", "asc")
      );
      const snapshot = await getDocs(qEvents);

      if (snapshot.empty) {
        homeAllEvents = [];
        renderHomeEvents([]);
        updateHomeStatsFromEvents([]);
        return;
      }

      homeAllEvents = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      updateHomeStatsFromEvents(homeAllEvents);
      renderHomeEvents(homeAllEvents);
    } catch (err) {
      console.error("Home page events load error:", err);
      if (homeFeaturedGrid) {
        homeFeaturedGrid.innerHTML = "<p>Failed to load events.</p>";
      }
    }

    // Load registrations count separately
    await loadRegisteredStudentsCount();
  }

  if (homeFeaturedGrid) {
    // We are on the home page
    loadHomePageData();

    if (homeSearchInput) {
      homeSearchInput.addEventListener("input", applyHomeSearchFilter);
    }
  }




  // SHOW/HIDE LOGIN & LOGOUT & ADMIN "ADD EVENT" IN NAVBAR + ROUTE PROTECTION

  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");
  const navList = document.querySelector("#primary-nav ul");

  // Function to update auth UI state
  function updateAuthUI(user) {
    // Header login/logout toggle
    if (loginLink && logoutBtn) {
      if (user) {
        loginLink.hidden = true;
        logoutBtn.hidden = false;
      } else {
        logoutBtn.hidden = true;
        loginLink.hidden = false;
      }
    }
  }

  // Check current auth state immediately to prevent flash
  const currentUser = auth.currentUser;
  if (currentUser !== null) {
    updateAuthUI(currentUser);
  }

  onAuthStateChanged(auth, (user) => {
    const isProtected = body.dataset.protected === "true";
    const isAuthPage =
      body.dataset.authPage === "login" ||
      body.dataset.authPage === "register" ||
      body.dataset.authPage === "forgot";

    const isAdmin = user && ADMIN_EMAILS.includes(user.email);
    console.log("Auth state changed:", { email: user?.email, isAdmin });

    // Update auth UI
    updateAuthUI(user);

    // Admin-only "Add Event" nav item
    if (navList) {
      let addEventItem = document.getElementById("add-event-nav-item");

      if (isAdmin) {
        if (!addEventItem) {
          addEventItem = document.createElement("li");
          addEventItem.id = "add-event-nav-item";
          addEventItem.innerHTML = `<a href="addEvent.html">Add Event</a>`;
          navList.appendChild(addEventItem);
        }
      } else {
        if (addEventItem) addEventItem.remove();
      }
    }

    // Protect pages that require login
    if (isProtected && !user) {
      window.location.href = "loginPage.html";
      return;
    }

    // If already logged in and on an auth page, send to home
    if (isAuthPage && user) {
      window.location.href = "index.html";
      return;
    }

    // If on Add Event page and user is not admin, redirect away
    if (page === "add-event" && (!user || !isAdmin)) {
      window.location.href = "index.html";
    }
  });
});

// MOBILE NAV TOGGLE

const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.getElementById("primary-nav");

if (menuToggle && primaryNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = primaryNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}
