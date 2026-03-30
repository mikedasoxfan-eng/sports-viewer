/**
 * Authentication gate — blocks the app until logged in.
 */

export async function checkAuth() {
  try {
    const res = await fetch('/api/auth/check', { credentials: 'include' });
    const data = await res.json();
    return data;
  } catch {
    return { required: false, authenticated: true };
  }
}

export function AuthGate(root, onSuccess) {
  let errorMsg = '';

  function render() {
    root.innerHTML = `
      <div class="min-h-[100dvh] bg-surface font-sans text-ink flex items-center justify-center px-4">
        <div class="w-full max-w-xs">
          <div class="rounded-3xl bg-surface-card shadow-diffused border border-ink-faint/15 p-8">
            <div class="text-center mb-8">
              <p class="font-mono font-bold text-lg tracking-tight text-ink mb-1">
                sports<span class="text-ink-muted font-normal">.viewer</span>
              </p>
              <p class="font-sans text-xs text-ink-muted">Enter password to continue</p>
            </div>

            <form id="auth-form" class="space-y-4">
              <div>
                <input type="password" id="auth-password" autofocus autocomplete="current-password"
                  placeholder="Password"
                  class="w-full px-4 py-3 rounded-2xl bg-surface-elevated border border-ink-faint/15
                         font-mono text-sm text-ink placeholder-ink-muted/50
                         transition-all duration-300 ease-smooth
                         focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink-faint/30" />
              </div>
              ${errorMsg ? `<p class="font-mono text-xs text-live text-center">${errorMsg}</p>` : ''}
              <button type="submit"
                class="w-full py-3 rounded-2xl bg-ink text-surface-card
                       text-sm font-medium font-sans
                       transition-all duration-300 ease-smooth
                       hover:bg-ink/90 active:scale-[0.97]">
                Enter
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#auth-form').addEventListener('submit', async e => {
      e.preventDefault();
      const password = root.querySelector('#auth-password').value;
      if (!password) return;

      const btn = root.querySelector('button[type="submit"]');
      btn.textContent = '...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
          onSuccess();
        } else {
          errorMsg = data.error || 'Wrong password';
          render();
        }
      } catch {
        errorMsg = 'Connection failed';
        render();
      }
    });
  }

  render();
}
