/**
 * ============================================================
 * AERCOM CRM v2
 * Theme Module
 * Migrado tal cual desde index.html (Sprint 12)
 * ============================================================
 *
 * Responsabilidad: tema claro/oscuro — detección del tema
 * guardado o preferido por el sistema, botón de toggle en el
 * sidebar (creado dinámicamente por `initTheme()`), actualización
 * del ícono, y persistencia en `localStorage` (clave `theme`,
 * independiente de `STORAGE_KEY`/`D`).
 *
 * Dependencias externas (definidas en index.html, sin mover —
 * no son responsabilidad de este módulo):
 *   curModule, renderDashboardCharts() (js/modules/dashboard.js —
 *   se re-renderizan los charts al cambiar de tema para que
 *   tomen los colores nuevos, pero Theme no es dueño del dashboard).
 *
 * `initTheme()` se sigue invocando desde el bloque INIT de
 * index.html (no se mueve el bootstrap, solo la lógica del
 * módulo en sí).
 */

function initTheme() {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored === 'dark' || (!stored && prefersDark);
  document.body.classList.toggle('dark-theme', isDark);

  if (!document.getElementById('theme-toggle')) {
    const brandDiv = document.querySelector('.sb-brand');
    if (brandDiv) {
      brandDiv.style.justifyContent = 'space-between';
      brandDiv.style.display = 'flex';
      brandDiv.style.alignItems = 'center';
      brandDiv.style.width = '100%';

      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'theme-toggle';
      toggleBtn.style.padding = '6px';
      toggleBtn.style.borderRadius = 'var(--r-sm)';
      toggleBtn.style.border = 'none';
      toggleBtn.style.background = 'transparent';
      toggleBtn.style.cursor = 'pointer';
      toggleBtn.style.display = 'flex';
      toggleBtn.style.alignItems = 'center';
      toggleBtn.style.justifyContent = 'center';
      toggleBtn.style.transition = 'background-color 0.2s ease';
      toggleBtn.title = 'Cambiar tema';
      toggleBtn.onclick = toggleTheme;

      brandDiv.appendChild(toggleBtn);
    }
  }

  updateThemeIcon(isDark);
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);

  // Re-render dashboard charts to update dynamic grid and text colors
  if (curModule === 'dashboard') {
    renderDashboardCharts();
  }
}

function updateThemeIcon(isDark) {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    if (isDark) {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#f8fafc"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
      btn.title = "Cambiar a modo claro";
    } else {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#0f172a"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      btn.title = "Cambiar a modo oscuro";
    }
  }
}
