// JS/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

//  Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDrvrhISJEB_TmHm0GlqmpjvP1haFYFfVQ",
  authDomain: "usiueventswebpagebackend.firebaseapp.com",
  projectId: "usiueventswebpagebackend",
  storageBucket: "usiueventswebpagebackend.firebasestorage.app",
  messagingSenderId: "1070584142416",
  appId: "1:1070584142416:web:133d2ea364a5ab97d0cf55"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

console.log("Storage bucket in use:", storage.app.options.storageBucket);

export { app, auth, storage, db };
