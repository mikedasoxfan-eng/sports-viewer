/**
 * DOM utilities — tagged templates, selectors, event delegation.
 */

const ESC_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

const escapeHtml = value => {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, char => ESC_MAP[char]);
};

/**
 * Tagged template literal that escapes interpolated values.
 * Use html`...` for safe HTML construction.
 */
export function html(strings, ...values) {
  let result = '';
  strings.forEach((str, i) => {
    result += str;
    if (i < values.length) {
      const val = values[i];
      // Allow raw HTML when wrapped in { __html: '...' }
      if (val && typeof val === 'object' && '__html' in val) {
        result += val.__html;
      } else {
        result += escapeHtml(val);
      }
    }
  });
  return result;
}

/** Raw HTML passthrough — use sparingly, only for trusted content */
export const raw = value => ({ __html: value });

/** querySelector shorthand */
export const $ = (selector, scope = document) => scope.querySelector(selector);

/** querySelectorAll as array */
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/**
 * Event delegation.
 * Returns a cleanup function to remove the listener.
 */
export function delegate(container, eventType, selector, handler) {
  const listener = e => {
    const target = e.target.closest(selector);
    if (target && container.contains(target)) {
      handler(e, target);
    }
  };
  container.addEventListener(eventType, listener);
  return () => container.removeEventListener(eventType, listener);
}

/**
 * Mount HTML string into a container.
 */
export function mount(container, htmlString) {
  container.innerHTML = htmlString;
  return container;
}

/**
 * Set up IntersectionObserver for fade-up animations.
 * Observes elements with [data-animate] attribute.
 */
export function observeAnimations(root = document) {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('stagger-in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  root.querySelectorAll('[data-animate]').forEach(el => {
    observer.observe(el);
  });

  return () => observer.disconnect();
}
