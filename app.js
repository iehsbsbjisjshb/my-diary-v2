import { getState, setState, onStateChange } from './storage.js';
import { isConfigured, pullAndMerge, push, setInitialLoadComplete } from './sync.js';
import { showToast } from './toast.js';
import * as todayScreen from './ui/today.js';
import * as weekScreen from './ui/week.js';
import * as schoolScreen from './ui/school.js';
import * as notesScreen from './ui/notes.js';
import * as settingsScreen from './ui/settings.js';

const routes = {
  '#/today': todayScreen,
  '#/week': weekScreen,
  '#/school': schoolScreen,
  '#/notes': notesScreen,
  '#/settings': settingsScreen
};

const DEFAULT_ROUTE = '#/today';

function getAppContainer() {
  return document.getElementById('app');
}

function getRouteKey(hash) {
  return (hash || DEFAULT_ROUTE).split('?')[0];
}

function updateNavActive(currentHash) {
  const routeKey = getRouteKey(currentHash);
  const navLinks = document.querySelectorAll('.app-nav .nav-link');
  navLinks.forEach((link) => {
    if (link.getAttribute('href') === routeKey) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

let lastRenderedRouteKey = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderCurrentRoute() {
  const hash = window.location.hash || DEFAULT_ROUTE;
  const routeKey = getRouteKey(hash);
  const screen = routes[routeKey];

  if (!screen) {
    window.location.hash = DEFAULT_ROUTE;
    return;
  }

  updateNavActive(hash);

  const container = getAppContainer();
  if (container && typeof screen.render === 'function') {
    // Анимация плавного появления только при реальном переходе между вкладками
    if (routeKey !== lastRenderedRouteKey) {
      container.classList.remove('page-fade-in');
      void container.offsetWidth; // Force reflow
      container.classList.add('page-fade-in');
      container.addEventListener('animationend', () => {
        container.classList.remove('page-fade-in');
      }, { once: true });
      lastRenderedRouteKey = routeKey;
    }

    try {
      screen.render(container, getState());
    } catch (err) {
      console.error(`Ошибка при отображении раздела ${routeKey}:`, err);
      container.innerHTML = `
        <div class="route-error-box" style="padding: 2.5rem 1.5rem; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">⚠️</div>
          <h3 style="color: #ef4444; margin-bottom: 0.5rem; font-size: 1.15rem;">Ошибка при отображении раздела</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; max-width: 480px; margin-left: auto; margin-right: auto;">${escapeHtml(err.message || 'Неизвестная ошибка')}</p>
          <button type="button" class="btn btn-accent btn-sm" onclick="window.location.reload()">Перезагрузить страницу</button>
        </div>
      `;
    }
  }
}

// Глобальный доступ для вызова перерисовки из других модулей (например, sync.js)
if (typeof window !== 'undefined') {
  window.renderCurrentRoute = renderCurrentRoute;
}

// Слушатель роутинга
window.addEventListener('hashchange', renderCurrentRoute);

// Слушатель изменений локального состояния: перерисовка + debounced push
onStateChange((state, options) => {
  const isUserTyping = document.activeElement && 
    (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') &&
    document.activeElement.type !== 'checkbox' &&
    document.activeElement.type !== 'radio';

  if (options?.fromRemote && isUserTyping) {
    const activeEl = document.activeElement;
    const onBlur = () => {
      activeEl.removeEventListener('blur', onBlur);
      renderCurrentRoute();
    };
    activeEl.addEventListener('blur', onBlur);
  } else {
    renderCurrentRoute();
  }

  if (!options?.fromRemote && isConfigured()) {
    push(state);
  }
});

// Синхронизация при старте приложения: сначала pullAndMerge(), затем разблокировка push
async function syncOnStart() {
  if (!isConfigured()) {
    setInitialLoadComplete(true);
    return;
  }

  setInitialLoadComplete(false);
  try {
    const success = await pullAndMerge();
    if (success) {
      showToast('Синхронизировано', { type: 'success' });
    }
  } catch (err) {
    console.warn('Initial sync error:', err);
  } finally {
    setInitialLoadComplete(true);
  }
}

// Отображение тоста обновления PWA
function showUpdateToast(worker) {
  showToast('Доступна новая версия', {
    duration: 0,
    action: {
      text: 'Обновить',
      onClick: () => worker.postMessage({ type: 'SKIP_WAITING' })
    }
  });
}

// Регистрация Service Worker и обработка обновлений
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const register = () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        // Если уже есть ожидающий новый воркер
        if (reg.waiting && navigator.serviceWorker.controller) {
          showUpdateToast(reg.waiting);
          return;
        }

        // Слушаем обнаружение новой версии
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(newWorker);
            }
          });
        });
      })
      .catch((err) => {
        console.warn('Ошибка регистрации Service Worker:', err);
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register);
  }
}

// Инициализация при загрузке DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  const routeKey = getRouteKey(window.location.hash);
  if (!window.location.hash || !routes[routeKey]) {
    window.location.hash = DEFAULT_ROUTE;
  } else {
    renderCurrentRoute();
  }

  // Запуск фоновой синхронизации при старте
  syncOnStart();

  // Регистрация PWA Service Worker
  registerServiceWorker();
}
