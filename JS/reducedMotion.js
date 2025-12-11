
// Respect the user's OS-level "Reduce Motion" preference across the site.

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function applyReducedMotion(prefersReduce) {
  const root = document.documentElement;

  if (prefersReduce) {
    // Add a hook class so CSS can tone down animations
    root.classList.add("reduce-motion");

    // Avoid forced smooth scrolling for people who dislike motion
    if (!root.dataset.originalScrollBehavior) {
      root.dataset.originalScrollBehavior = root.style.scrollBehavior || "";
    }
    root.style.scrollBehavior = "auto";
  } else {
    root.classList.remove("reduce-motion");

    // Restore whatever scroll-behavior was there before, if any
    if (root.dataset.originalScrollBehavior !== undefined) {
      root.style.scrollBehavior = root.dataset.originalScrollBehavior;
    } else {
      root.style.scrollBehavior = "";
    }
  }
}

// Apply once on load
applyReducedMotion(motionQuery.matches);

// Update if the user changes the OS setting while the page is open
if (typeof motionQuery.addEventListener === "function") {
  motionQuery.addEventListener("change", (e) =>
    applyReducedMotion(e.matches)
  );
} else if (typeof motionQuery.addListener === "function") {
  // Older browsers
  motionQuery.addListener((e) => applyReducedMotion(e.matches));
}
