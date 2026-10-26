let currentToastElement = null;
let toastTimeoutId = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add('app-toast-hiding');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
    if (currentToastElement === toast) {
      currentToastElement = null;
    }
  }, 200);
}

export function showToast(message, options = {}) {
  const {
    duration = 2500,
    action = null, // { text: '...', onClick: () => {} }
    type = 'info' // 'info' | 'success' | 'error'
  } = options;

  if (currentToastElement) {
    clearTimeout(toastTimeoutId);
    currentToastElement.remove();
    currentToastElement = null;
  }

  const toast = document.createElement('div');
  toast.className = `app-toast app-toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="app-toast-content">
      <span class="app-toast-text">${escapeHtml(message)}</span>
      ${
        action
          ? `<button type="button" class="btn btn-accent btn-sm app-toast-action">${escapeHtml(action.text)}</button>`
          : ''
      }
      <button type="button" class="app-toast-close" aria-label="Закрыть">✕</button>
    </div>
  `;

  document.body.appendChild(toast);
  currentToastElement = toast;

  if (action && typeof action.onClick === 'function') {
    toast.querySelector('.app-toast-action')?.addEventListener('click', () => {
      action.onClick();
      dismissToast(toast);
    });
  }

  toast.querySelector('.app-toast-close')?.addEventListener('click', () => {
    dismissToast(toast);
  });

  if (duration > 0) {
    toastTimeoutId = setTimeout(() => {
      dismissToast(toast);
    }, duration);
  }

  return toast;
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
