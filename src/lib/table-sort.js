/**
 * Client-side table sorting — click any <th> to sort its column.
 * Works on any table within the delegated root element.
 * Skips rows with [data-sort-pin] (career totals, etc.).
 */

function parseVal(text) {
  if (!text || text === '-') return -Infinity;
  const t = text.trim();
  // Numeric
  const n = parseFloat(t.replace(/,/g, ''));
  if (!isNaN(n)) return n;
  // Compound "6-13" → use first number
  const dash = t.split('-');
  if (dash.length === 2) { const d = parseFloat(dash[0]); if (!isNaN(d)) return d; }
  // Time "21:51" → seconds
  const colon = t.split(':');
  if (colon.length === 2) { const m = parseFloat(colon[0]), s = parseFloat(colon[1]); if (!isNaN(m) && !isNaN(s)) return m * 60 + s; }
  // String fallback
  return t.toLowerCase();
}

function cmp(a, b, asc) {
  if (typeof a === 'string' && typeof b === 'string') return asc ? a.localeCompare(b) : b.localeCompare(a);
  if (a === b) return 0;
  return asc ? a - b : b - a;
}

export function enableTableSort(root) {
  root.addEventListener('click', e => {
    const th = e.target.closest('thead th');
    if (!th) return;
    const table = th.closest('table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const idx = [...th.parentElement.children].indexOf(th);
    if (idx < 0) return;

    // Toggle direction
    const wasAsc = th.getAttribute('data-sort-dir') === 'asc';
    const asc = !wasAsc;

    // Clear indicators on all headers
    table.querySelectorAll('thead th').forEach(h => {
      h.removeAttribute('data-sort-dir');
      h.classList.remove('text-accent');
      // Remove old arrow
      const arrow = h.querySelector('.sort-arrow');
      if (arrow) arrow.remove();
    });

    // Set current
    th.setAttribute('data-sort-dir', asc ? 'asc' : 'desc');
    th.classList.add('text-accent');
    th.insertAdjacentHTML('beforeend', `<span class="sort-arrow ml-0.5">${asc ? '\u2191' : '\u2193'}</span>`);

    // Separate pinned (totals) and sortable rows
    const rows = [...tbody.querySelectorAll('tr')];
    const pinned = rows.filter(r => r.hasAttribute('data-sort-pin'));
    const sortable = rows.filter(r => !r.hasAttribute('data-sort-pin'));

    sortable.sort((a, b) => {
      const aVal = parseVal(a.children[idx]?.textContent);
      const bVal = parseVal(b.children[idx]?.textContent);
      return cmp(aVal, bVal, asc);
    });

    // Re-append in order: sortable first, then pinned (career totals at bottom)
    const frag = document.createDocumentFragment();
    sortable.forEach(r => frag.appendChild(r));
    pinned.forEach(r => frag.appendChild(r));
    tbody.appendChild(frag);
  });
}
