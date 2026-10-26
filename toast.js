let toastContainer = null;
let activeToasts = [];
let isContainerHovered = false;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ICONS = {
  success: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  error: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  info: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

function getToastContainer() {
  if (!toastContainer || !toastContainer.parentNode) {
    toastContainer = document.getElementById('app-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'app-toast-container';
      toastContainer.className = 'app-toast-container';
      toastContainer.setAttribute('aria-live', 'polite');
      (document.body || document.documentElement).appendChild(toastContainer);

      toastContainer.addEventListener('mouseenter', pauseAllToastTimers);
      toastContainer.addEventListener('mouseleave', resumeAllToastTimers);
    }
  }
  return toastContainer;
}

function pauseAllToastTimers() {
  isContainerHovered = true;
  const now = Date.now();
  activeToasts.forEach(item => {
    if (item.timeoutId) {
      clearTimeout(item.timeoutId);
      item.timeoutId = null;
    }
    const elapsed = now - item.startTime;
    item.remainingMs = Math.max(0, item.remainingMs - elapsed);
  });
  updateStackPositions();
}

function resumeAllToastTimers() {
  isContainerHovered = false;
  activeToasts.forEach(item => {
    if (item.duration > 0 && !item.isExiting) {
      item.remainingMs = Math.max(item.remainingMs, 1200);
      scheduleToastTimer(item);
    }
  });
  updateStackPositions();
}

function scheduleToastTimer(item) {
  if (item.timeoutId) {
    clearTimeout(item.timeoutId);
  }
  item.startTime = Date.now();
  item.timeoutId = setTimeout(() => {
    dismissToast(item.id);
  }, item.remainingMs);
}

export function dismissToast(toastElementOrId) {
  const item = typeof toastElementOrId === 'string'
    ? activeToasts.find(t => t.id === toastElementOrId)
    : activeToasts.find(t => t.element === toastElementOrId);

  if (!item || item.isExiting) return;
  item.isExiting = true;

  if (item.timeoutId) {
    clearTimeout(item.timeoutId);
    item.timeoutId = null;
  }

  // Float slightly higher up and fade out smoothly ("плавно наверх, поглощая")
  const currentY = item.currentYOffset || 0;
  const exitY = currentY + 16;
  const currentScale = item.currentScale || 1;

  item.element.style.pointerEvents = 'none';
  item.element.style.opacity = '0';
  item.element.style.transform = `translate3d(0, -${exitY}px, 0) scale(${currentScale * 0.94})`;

  const idx = activeToasts.indexOf(item);
  if (idx !== -1) {
    activeToasts.splice(idx, 1);
  }

  updateStackPositions();

  setTimeout(() => {
    if (item.element && item.element.parentNode) {
      item.element.parentNode.removeChild(item.element);
    }
  }, 320);
}

function updateStackPositions() {
  let accumulatedHeight = 0;
  const GAP = 10;
  const MAX_VISIBLE = 3;

  const list = [...activeToasts];

  list.forEach((item, index) => {
    if (item.isExiting) return;

    if (index >= MAX_VISIBLE) {
      dismissToast(item.id);
      return;
    }

    const el = item.element;
    const yOffset = accumulatedHeight;
    const scale = Math.max(0.88, 1 - index * 0.045);
    const opacity = isContainerHovered ? 1 : Math.max(0.4, 1 - index * 0.22);
    const zIndex = 100 - index;

    item.currentYOffset = yOffset;
    item.currentScale = scale;

    el.style.zIndex = zIndex;
    el.style.opacity = String(opacity);
    el.style.transform = `translate3d(0, -${yOffset}px, 0) scale(${scale})`;

    const height = el.offsetHeight || 50;
    accumulatedHeight += height + GAP;
  });
}

export function showToast(message, options = {}) {
  const {
    duration = 2700,
    action = null, // { text: '...', onClick: () => {} }
    type = 'info' // 'info' | 'success' | 'error'
  } = options;

  const container = getToastContainer();
  const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  const toast = document.createElement('div');
  toast.className = `app-toast app-toast-${type} app-toast-entering`;
  toast.setAttribute('role', 'alert');
  toast.id = id;

  const iconSvg = ICONS[type] || ICONS.info;

  toast.innerHTML = `
    <div class="app-toast-content">
      <span class="app-toast-icon-wrap" aria-hidden="true">${iconSvg}</span>
      <span class="app-toast-text">${escapeHtml(message)}</span>
      ${
        action
          ? `<button type="button" class="app-toast-action">${escapeHtml(action.text)}</button>`
          : ''
      }
      <button type="button" class="app-toast-close" aria-label="Закрыть">✕</button>
    </div>
  `;

  container.appendChild(toast);

  const toastItem = {
    id,
    element: toast,
    duration,
    remainingMs: duration,
    startTime: Date.now(),
    timeoutId: null,
    isExiting: false,
    currentYOffset: 0,
    currentScale: 1
  };

  activeToasts.unshift(toastItem);

  if (action && typeof action.onClick === 'function') {
    toast.querySelector('.app-toast-action')?.addEventListener('click', (e) => {
      e.stopPropagation();
      action.onClick();
      dismissToast(id);
    });
  }

  toast.querySelector('.app-toast-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissToast(id);
  });

  if (duration > 0 && !isContainerHovered) {
    scheduleToastTimer(toastItem);
  }

  // Force reflow so the initial .app-toast-entering styles are registered
  void toast.offsetHeight;
  toast.classList.remove('app-toast-entering');

  requestAnimationFrame(() => {
    updateStackPositions();
  });

  return toast;
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
  window.dismissToast = dismissToast;
}
