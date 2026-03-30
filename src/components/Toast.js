/**
 * Toast notification system.
 */

let toastContainer = null;

function ensureContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none';
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function showToast(message, duration = 2500) {
  const container = ensureContainer();
  const el = document.createElement('div');
  el.className = `
    pointer-events-auto px-5 py-2.5 rounded-full
    bg-ink text-surface-card text-sm font-medium font-sans
    shadow-diffused
    opacity-0 translate-y-2
    transition-all duration-500 ease-smooth
  `.trim();
  el.textContent = message;
  container.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.remove('opacity-0', 'translate-y-2');
    el.classList.add('opacity-100', 'translate-y-0');
  });

  setTimeout(() => {
    el.classList.remove('opacity-100', 'translate-y-0');
    el.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => el.remove(), 500);
  }, duration);
}
