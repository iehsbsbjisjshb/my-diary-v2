let pushTimeoutId = null;
let pendingPushState = null;

export function isConfigured() {
  const url = localStorage.getItem('syncUrl');
  const secret = localStorage.getItem('syncSecret');
  return Boolean(url && url.trim() && secret && secret.trim());
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

async function executePush(state) {
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
  return push(state, true);
}
