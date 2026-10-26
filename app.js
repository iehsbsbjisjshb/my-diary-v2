import { getState, setState, onStateChange } from './storage.js';
import { isConfigured, pull, push } from './sync.js';
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

function renderCurrentRoute() {
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
    container.classList.remove('page-fade-in');
    void container.offsetWidth; // Force reflow
    container.classList.add('page-fade-in');

    screen.render(container, getState());
  }
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

// Синхронизация при старте приложения (Last-write-wins по updatedAt)
async function syncOnStart() {
  if (!isConfigured()) return;
  try {
    const remote = await pull();
    if (remote === null) {
      // Ошибка синка или невалидный JSON с сервера
      showToast('Синхронизация не удалась', { type: 'error' });
      return;
    }

    if (typeof remote !== 'object' || Object.keys(remote).length === 0) {
      // На сервере пусто — пушим текущий локальный state
      const local = getState();
      push(local);
      return;
    }

    const local = getState();
    const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
    const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;

    if (remoteTime > localTime) {
      // Состояние сервера свежее — применяем его
      setState(() => remote, { preserveUpdatedAt: true, fromRemote: true });
      showToast('Синхронизировано', { type: 'success' });
    } else if (localTime > remoteTime) {
      // Локальное состояние свежее — отправляем на сервер
      push(local);
    }
  } catch (err) {
    console.warn('Initial sync error:', err);
    showToast('Синхронизация не удалась', { type: 'error' });
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
