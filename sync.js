import { getState, setState } from './storage.js';

let pushTimeoutId = null;
let pendingPushState = null;
let isInitialLoadComplete = false;

export function isConfigured() {
  const url = localStorage.getItem('syncUrl');
  const secret = localStorage.getItem('syncSecret');
  return Boolean(url && url.trim() && secret && secret.trim());
}

export function isInitialLoadDone() {
  return isInitialLoadComplete;
}

export function setInitialLoadComplete(value = true) {
  isInitialLoadComplete = Boolean(value);
}

export function getSyncEndpoint() {
  const rawUrl = localStorage.getItem('syncUrl');
  if (!rawUrl || !rawUrl.trim()) return null;
  let url = rawUrl.trim().replace(/\/+$/, '');
  return url.endsWith('/state') ? url : `${url}/state`;
}

export function getSyncSecret() {
  const secret = localStorage.getItem('syncSecret');
  return secret ? secret.trim() : '';
}

export async function pull() {
  if (!isConfigured()) return null;
  const endpoint = getSyncEndpoint();
  const secret = getSyncSecret();

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-Sync-Secret': secret
      }
    });

    if (res.status === 200) {
      const data = await res.json();
      return data && typeof data === 'object' ? data : null;
    } else {
      console.warn(`Sync pull HTTP ${res.status}`);
      return null;
    }
  } catch (err) {
    console.warn('Sync pull error:', err);
    return null;
  }
}

/**
 * pullAndMerge:
 * Выполняет GET запрос к Cloudflare Worker.
 * Если ответ 200 и пришел валидный JSON (не пустой объект),
 * полностью заменяет локальный state данными с сервера,
 * сохраняет их в localStorage и вызывает глобальное обновление UI.
 */
export async function pullAndMerge() {
  if (!isConfigured()) return false;
  const endpoint = getSyncEndpoint();
  const secret = getSyncSecret();

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-Sync-Secret': secret
      }
    });

    if (res.status === 200) {
      const remote = await res.json();
      if (remote && typeof remote === 'object' && Object.keys(remote).length > 0) {
        // Заменяем локальный state данными с сервера
        localStorage.setItem('diary-v2', JSON.stringify(remote));
        const normalized = getState();
        setState(() => normalized, { preserveUpdatedAt: true, fromRemote: true });
        localStorage.setItem('syncLastSync', new Date().toISOString());

        // Глобальное обновление UI
        if (typeof window !== 'undefined' && typeof window.renderCurrentRoute === 'function') {
          window.renderCurrentRoute();
        }

        return true;
      } else {
        console.warn('Sync pullAndMerge: пустой объект или нет данных на сервере');
        return false;
      }
    } else {
      console.warn(`Sync pullAndMerge HTTP ${res.status}`);
      return false;
    }
  } catch (err) {
    console.warn('Sync pullAndMerge error:', err);
    return false;
  }
}

async function executePush(state) {
  if (!isInitialLoadComplete) {
    console.warn('Sync push blocked: initial load is not complete');
    return false;
  }
  if (!isConfigured() || !state) return false;
  const endpoint = getSyncEndpoint();
  const secret = getSyncSecret();

  try {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Secret': secret
      },
      body: JSON.stringify(state)
    });

    if (res.ok) {
      localStorage.setItem('syncLastSync', new Date().toISOString());
      return true;
    } else {
      console.warn(`Sync push HTTP ${res.status}`);
      return false;
    }
  } catch (err) {
    console.warn('Sync push error:', err);
    return false;
  }
}

export function push(state, immediate = false) {
  if (!isInitialLoadComplete) {
    console.warn('Sync push blocked: initial load is not complete');
    return Promise.resolve(false);
  }

  pendingPushState = state;

  if (immediate) {
    if (pushTimeoutId) {
      clearTimeout(pushTimeoutId);
      pushTimeoutId = null;
    }
    return executePush(pendingPushState);
  }

  if (pushTimeoutId) {
    clearTimeout(pushTimeoutId);
  }

  return new Promise((resolve) => {
    pushTimeoutId = setTimeout(async () => {
      pushTimeoutId = null;
      const success = await executePush(pendingPushState);
      resolve(success);
    }, 1500);
  });
}

export async function pushImmediate(state) {
  if (!isInitialLoadComplete) {
    console.warn('Sync pushImmediate blocked: initial load is not complete');
    return false;
  }
  return push(state, true);
}
