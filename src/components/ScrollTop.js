/**
 * Floating scroll-to-top button — appears after scrolling down.
 */

export function ScrollTop() {
  const btn = document.createElement('button');
  btn.id = 'scroll-top';
  btn.className = `fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full
    bg-surface-card/90 backdrop-blur-xl shadow-card-hover border border-ink-faint/15
    flex items-center justify-center
    text-ink-muted hover:text-ink
    transition-all duration-300 ease-smooth
    hover:shadow-diffused hover:-translate-y-0.5
    active:scale-95
    opacity-0 pointer-events-none translate-y-4`;
  btn.setAttribute('aria-label', 'Scroll to top');
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="m18 15-6-6-6 6"/>
    </svg>`;

  document.body.appendChild(btn);

  let visible = false;

  function update() {
    const shouldShow = window.scrollY > 400;
    if (shouldShow === visible) return;
    visible = shouldShow;
    if (visible) {
      btn.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
      btn.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
    } else {
      btn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
      btn.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
    }
  }

  window.addEventListener('scroll', update, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
