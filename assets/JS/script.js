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