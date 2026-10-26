import { getState, setState, resetState } from '../storage.js';
import { isConfigured, pull, pushImmediate } from '../sync.js';
import { showToast } from '../toast.js';

let isAddingGoal = false;
let editingGoalId = null;
let isResetModalOpen = false;
let resetInputValue = '';
let syncStatusMessage = '';
let isSyncing = false;
let appVersion = '2.0.0';

// Загружаем версию из manifest.json
fetch('manifest.json')
  .then((r) => r.json())
  .then((m) => {
    if (m && m.version) appVersion = m.version;
  })
  .catch(() => {});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function render(container, state) {
  const goals = state.goals || [];
  const chinese = state.chinese || {};
  const syncUrl = localStorage.getItem('syncUrl') || '';
  const syncSecret = localStorage.getItem('syncSecret') || '';
  const lastSync = localStorage.getItem('syncLastSync');
  const isResetWordCorrect = resetInputValue.trim().toUpperCase() === 'СБРОС';

  container.innerHTML = `
    <div class="settings-screen">
      <h1>Настройки</h1>

      <!-- СЕКЦИЯ 1: ЦЕЛИ -->
      <section class="settings-section">
        <div class="settings-card">
          <div class="settings-card-header-row">
            <div>
              <h3>🎯 Главные цели</h3>
              <p class="settings-subtext">Отображаются в шапке главного экрана «Сегодня»</p>
            </div>
            ${
              !isAddingGoal && !editingGoalId
                ? `<button class="btn btn-accent btn-sm" id="btn-open-add-goal">+ Добавить цель</button>`
                : ''
            }
          </div>

          <!-- Форма добавления/редактирования цели -->
          ${
            isAddingGoal || editingGoalId
              ? renderGoalForm(
                  editingGoalId
                    ? goals.find((g) => g.id === editingGoalId) || { id: '', title: '', deadline: '' }
                    : { id: '', title: '', deadline: '' },
                  isAddingGoal
                )
              : ''
          }

          <!-- Список целей -->
          <div class="goals-management-list">
            ${
              goals.length === 0
                ? `<div class="settings-empty">Цели пока не заданы.</div>`
                : goals
                    .map(
                      (g) => `
                  <div class="goal-manage-item" data-goal-id="${g.id}">
                    <div class="goal-manage-info">
                      <span class="goal-manage-title">${escapeHtml(g.title)}</span>
                      ${g.deadline ? `<span class="goal-manage-deadline">до ${escapeHtml(g.deadline)}</span>` : ''}
                    </div>
                    <div class="goal-manage-actions">
                      <button class="btn btn-secondary btn-sm btn-edit-goal" data-edit-goal-id="${g.id}" title="Редактировать">✎</button>
                      <button class="btn-delete-goal" data-delete-goal-id="${g.id}" title="Удалить цель">✕</button>
                    </div>
                  </div>
                `
                    )
                    .join('')
            }
          </div>
        </div>
      </section>

      <!-- СЕКЦИЯ 2: КИТАЙСКИЙ -->
      <section class="settings-section">
        <div class="settings-card">
          <div class="settings-card-header">
            <h3>🇨🇳 Китайский язык</h3>
            <p class="settings-subtext">Параметры ежедневного времени и целей по словарному запасу HSK</p>
          </div>

          <form class="settings-form" id="form-chinese-settings">
            <div class="settings-row">
              <label class="settings-label" for="setting-daily-minutes">Ежедневная цель занятий (dailyGoalMinutes):</label>
              <input type="number" class="form-input settings-input" id="setting-daily-minutes" min="5" max="360" step="5" value="${chinese.dailyGoalMinutes ?? 60}" required />
            </div>

            <div class="settings-row">
              <label class="settings-label" for="setting-words-target">Целевое количество слов (wordsTarget):</label>
              <input type="number" class="form-input settings-input" id="setting-words-target" min="0" max="10000" step="10" value="${chinese.wordsTarget ?? 1200}" required />
            </div>

            <div class="settings-row">
              <label class="settings-label" for="setting-words-learned">Выучено слов на данный момент (wordsLearned):</label>
              <input type="number" class="form-input settings-input" id="setting-words-learned" min="0" max="10000" step="5" value="${chinese.wordsLearned ?? 0}" required />
            </div>

            <button type="submit" class="btn btn-accent btn-sm" style="align-self: flex-start;">Сохранить параметры китайского</button>
          </form>
        </div>
      </section>

      <!-- СЕКЦИЯ 3: СИНХРОНИЗАЦИЯ -->
      <section class="settings-section">
        <div class="settings-card">
          <div class="settings-card-header">
            <h3>☁️ Синхронизация (Cloudflare Worker)</h3>
            <p class="settings-subtext">GET / PUT /state с авторизацией заголовком X-Sync-Secret</p>
          </div>

          <form class="settings-form" id="form-sync-config">
            <div class="settings-row">
              <label class="settings-label" for="sync-url">URL воркера:</label>
              <input type="url" class="form-input" id="sync-url" placeholder="https://diary-sync.xxx.workers.dev/state" value="${escapeHtml(syncUrl)}" />
            </div>

            <div class="settings-row">
              <label class="settings-label" for="sync-secret">Секретный ключ (X-Sync-Secret):</label>
              <input type="password" class="form-input" id="sync-secret" placeholder="Секретный токен" value="${escapeHtml(syncSecret)}" />
            </div>

            <div class="sync-actions-row">
              <button type="submit" class="btn btn-secondary btn-sm" id="btn-save-sync">Сохранить</button>
              <button type="button" class="btn btn-accent btn-sm" id="btn-sync-now" ${isSyncing ? 'disabled' : ''}>
                ${isSyncing ? 'Синхронизация...' : '🔄 Синхронизировать сейчас'}
              </button>
            </div>
          </form>

          <div class="sync-status-box">
            <div class="sync-status-line">
              Последняя синхронизация: <strong>${lastSync ? new Date(lastSync).toLocaleString('ru-RU') : 'никогда'}</strong>
            </div>
            ${syncStatusMessage ? `<div class="sync-status-msg">${escapeHtml(syncStatusMessage)}</div>` : ''}
          </div>
        </div>
      </section>

      <!-- СЕКЦИЯ 4: ДАННЫЕ (ЭКСПОРТ, ИМПОРТ, СБРОС) -->
      <section class="settings-section">
        <div class="settings-card">
          <div class="settings-card-header">
            <h3>💾 Управление данными</h3>
            <p class="settings-subtext">Резервное копирование и полный сброс</p>
          </div>

          <div class="settings-backup-actions">
            <button class="btn btn-secondary btn-sm" id="btn-export-json">📥 Экспорт JSON</button>
            <label class="btn btn-secondary btn-sm" style="cursor: pointer;">
              📤 Импорт JSON
              <input type="file" id="input-import-json" accept=".json,application/json" style="display: none;" />
            </label>
            <button class="btn btn-danger btn-sm" id="btn-open-reset-modal">🗑 Сбросить всё</button>
          </div>
        </div>
      </section>

      <!-- СЕКЦИЯ 5: О ПРИЛОЖЕНИИ -->
      <section class="settings-section">
        <div class="settings-card about-card">
          <div class="about-app-title">Ежедневник • Личный инструмент самодисциплины</div>
          <div class="about-app-version">Версия: <strong>${escapeHtml(appVersion)}</strong> (PWA, offline-first)</div>
          <div class="about-app-sub">Никаких внешних библиотек, никаких трекеров, язык интерфейса — русский.</div>
        </div>
      </section>

      <!-- Модальное окно подтверждения сброса -->
      ${
        isResetModalOpen
          ? `
          <div class="modal-overlay" id="reset-modal-overlay">
            <div class="modal-card modal-card-danger">
              <div class="modal-header">
                <h3 style="color: #f87171;">⚠️ Подтверждение полного сброса</h3>
                <button class="modal-close" id="btn-close-reset-modal">✕</button>
              </div>

              <div class="modal-body-danger">
                <div class="danger-alert-box">
                  <strong>ВНИМАНИЕ:</strong> Это действие полностью очистит базу данных (ключ <code>diary-v2</code>).
                  Все задачи, расписание, история занятий и отзывы будут удалены.
                </div>

                <p class="reset-prompt-text">
                  Для защиты от случайного нажатия введите проверочное слово <span class="confirm-word-badge">СБРОС</span>:
                </p>

                <input 
                  type="text" 
                  class="form-input modal-input reset-confirm-input" 
                  id="input-reset-confirmation" 
                  placeholder="Введите СБРОС" 
                  value="${escapeHtml(resetInputValue)}"
                  autocomplete="off"
                  autofocus 
                />

                <div class="modal-actions" style="margin-top: 1rem;">
                  <button 
                    type="button" 
                    class="btn btn-danger ${!isResetWordCorrect ? 'btn-disabled' : ''}" 
                    id="btn-confirm-delete-all"
                    ${!isResetWordCorrect ? 'disabled' : ''}
                  >
                    Да, безвозвратно стереть всё
                  </button>
                  <button type="button" class="btn btn-secondary" id="btn-cancel-reset">
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
          `
          : ''
      }
    </div>
  `;

  attachEventListeners(container, state);
}

function renderGoalForm(goal, isNew) {
  const isTitleEmpty = !goal.title || !goal.title.trim();
  return `
    <form class="goal-inline-form" id="form-goal" data-is-new="${isNew ? '1' : '0'}" data-goal-id="${goal.id || ''}">
      <div class="form-row goal-form-row">
        <div class="form-col goal-title-col">
          <label class="form-label">Название цели *</label>
          <input type="text" class="form-input" id="goal-title-input" placeholder="Например: Сдать HSK 4+" value="${escapeHtml(goal.title)}" required autofocus />
        </div>
        <div class="form-col goal-date-col">
          <label class="form-label">Дедлайн (опционально)</label>
          <input type="date" class="form-input" id="goal-deadline-input" value="${escapeHtml(goal.deadline || '')}" />
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-accent btn-sm" id="btn-save-goal" ${isTitleEmpty ? 'disabled' : ''}>Сохранить цель</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-goal">Отмена</button>
      </div>
    </form>
  `;
}

async function handleManualSync(container) {
  const url = (container.querySelector('#sync-url')?.value || '').trim();
  const secret = (container.querySelector('#sync-secret')?.value || '').trim();

  localStorage.setItem('syncUrl', url);
  localStorage.setItem('syncSecret', secret);

  if (!isConfigured()) {
    syncStatusMessage = '❌ Укажите URL воркера и секретный ключ';
    showToast('Укажите URL и секрет', { type: 'error' });
    render(container, getState());
    return;
  }

  isSyncing = true;
  syncStatusMessage = 'Подключение к серверу...';
  render(container, getState());

  try {
    const remote = await pull();
    const local = getState();

    if (remote === null) {
      syncStatusMessage = '❌ Синхронизация не удалась (ошибка сервера или невалидный JSON)';
      showToast('Синхронизация не удалась', { type: 'error' });
      return;
    }

    if (typeof remote !== 'object' || Object.keys(remote).length === 0) {
      // На сервере пусто — отправляем локальный state
      const success = await pushImmediate(local);
      if (success) {
        localStorage.setItem('syncLastSync', new Date().toISOString());
        syncStatusMessage = `✓ Синхронизация успешна (данные сохранены на сервере в ${new Date().toLocaleTimeString('ru-RU')})`;
        showToast('Синхронизировано', { type: 'success' });
      } else {
        syncStatusMessage = '❌ Ошибка отправки на сервер';
        showToast('Синхронизация не удалась', { type: 'error' });
      }
    } else {
      const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
      const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;

      if (remoteTime > localTime) {
        // Сервер свежее
        setState(() => remote, { preserveUpdatedAt: true, fromRemote: true });
        localStorage.setItem('syncLastSync', new Date().toISOString());
        syncStatusMessage = `✓ Синхронизация успешна (получены свежие данные: ${new Date(remote.updatedAt).toLocaleTimeString('ru-RU')})`;
        showToast('Синхронизировано', { type: 'success' });
      } else {
        // Локальное свежее или совпадает
        const success = await pushImmediate(local);
        if (success) {
          localStorage.setItem('syncLastSync', new Date().toISOString());
          syncStatusMessage = `✓ Синхронизация успешна (сервер обновлён в ${new Date().toLocaleTimeString('ru-RU')})`;
          showToast('Синхронизировано', { type: 'success' });
        } else {
          syncStatusMessage = '❌ Ошибка отправки на сервер';
          showToast('Синхронизация не удалась', { type: 'error' });
        }
      }
    }
  } catch (err) {
    syncStatusMessage = `❌ Ошибка: ${err?.message || err}`;
    showToast('Синхронизация не удалась', { type: 'error' });
  } finally {
    isSyncing = false;
    render(container, getState());
  }
}

function attachEventListeners(container, state) {
  // Валидация поля цели
  const goalTitleInput = container.querySelector('#goal-title-input');
  const btnSaveGoal = container.querySelector('#btn-save-goal');
  if (goalTitleInput && btnSaveGoal) {
    goalTitleInput.addEventListener('input', () => {
      btnSaveGoal.disabled = !goalTitleInput.value.trim();
    });
  }

  // 1. ЦЕЛИ
  container.querySelector('#btn-open-add-goal')?.addEventListener('click', () => {
    isAddingGoal = true;
    editingGoalId = null;
    render(container, getState());
  });

  container.querySelector('#btn-cancel-goal')?.addEventListener('click', () => {
    isAddingGoal = false;
    editingGoalId = null;
    render(container, getState());
  });

  container.querySelectorAll('.btn-edit-goal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-goal-id');
      editingGoalId = id;
      isAddingGoal = false;
      render(container, getState());
    });
  });

  container.querySelectorAll('.btn-delete-goal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-goal-id');
      if (!confirm('Удалить эту цель?')) return;

      setState((prev) => ({
        ...prev,
        goals: (prev.goals || []).filter((g) => g.id !== id)
      }));
    });
  });

  container.querySelector('#form-goal')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const isNew = e.target.getAttribute('data-is-new') === '1';
    const goalId = e.target.getAttribute('data-goal-id');

    const titleInput = container.querySelector('#goal-title-input');
    const deadlineInput = container.querySelector('#goal-deadline-input');

    const title = titleInput.value.trim();
    if (!title) return;
    const deadline = deadlineInput.value;

    if (isNew) {
      const newGoal = {
        id: 'g_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        title,
        deadline
      };

      isAddingGoal = false;
      setState((prev) => ({
        ...prev,
        goals: [...(prev.goals || []), newGoal]
      }));
      showToast('Сохранено', { type: 'success' });
    } else {
      editingGoalId = null;
      setState((prev) => ({
        ...prev,
        goals: (prev.goals || []).map((g) =>
          g.id === goalId ? { ...g, title, deadline } : g
        )
      }));
      showToast('Сохранено', { type: 'success' });
    }
  });

  // 2. КИТАЙСКИЙ
  container.querySelector('#form-chinese-settings')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const dailyGoalMinutes = parseInt(container.querySelector('#setting-daily-minutes').value, 10);
    const wordsTarget = parseInt(container.querySelector('#setting-words-target').value, 10);
    const wordsLearned = parseInt(container.querySelector('#setting-words-learned').value, 10);

    setState((prev) => ({
      ...prev,
      chinese: {
        ...(prev.chinese || {}),
        dailyGoalMinutes: isNaN(dailyGoalMinutes) ? 60 : dailyGoalMinutes,
        wordsTarget: isNaN(wordsTarget) ? 1200 : wordsTarget,
        wordsLearned: isNaN(wordsLearned) ? 0 : wordsLearned
      }
    }));

    showToast('Сохранено', { type: 'success' });
  });

  // 3. СИНХРОНИЗАЦИЯ
  container.querySelector('#form-sync-config')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = (container.querySelector('#sync-url')?.value || '').trim();
    const secret = (container.querySelector('#sync-secret')?.value || '').trim();

    localStorage.setItem('syncUrl', url);
    localStorage.setItem('syncSecret', secret);
    syncStatusMessage = '✓ Настройки синхронизации сохранены';
    showToast('Сохранено', { type: 'success' });
    render(container, getState());
  });

  container.querySelector('#btn-sync-now')?.addEventListener('click', () => {
    handleManualSync(container);
  });

  // 4. ДАННЫЕ (ЭКСПОРТ / ИМПОРТ / СБРОС)
  container.querySelector('#btn-export-json')?.addEventListener('click', () => {
    const currentState = getState();
    const jsonStr = JSON.stringify(currentState, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nowISO = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `diary-v2-backup-${nowISO}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  container.querySelector('#input-import-json')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!imported || typeof imported !== 'object' || imported.version !== 2) {
          throw new Error('Файл не содержит корректную структуру данных Ежедневника v2 (version: 2)');
        }

        if (confirm('Заменить текущие данные данными из выбранного файла?')) {
          setState(() => imported);
          showToast('Данные успешно импортированы', { type: 'success' });
        }
      } catch (err) {
        showToast(`Ошибка импорта: ${err.message}`, { type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Модалка сброса
  container.querySelector('#btn-open-reset-modal')?.addEventListener('click', () => {
    isResetModalOpen = true;
    resetInputValue = '';
    render(container, getState());
  });

  const closeResetModal = () => {
    isResetModalOpen = false;
    resetInputValue = '';
    render(container, getState());
  };

  container.querySelector('#btn-close-reset-modal')?.addEventListener('click', closeResetModal);
  container.querySelector('#btn-cancel-reset')?.addEventListener('click', closeResetModal);

  let modalMouseDownTarget = null;
  container.querySelectorAll('#reset-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('mousedown', (e) => {
      modalMouseDownTarget = e.target;
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && modalMouseDownTarget === overlay) {
        closeResetModal();
      }
      modalMouseDownTarget = null;
    });
  });

  const inputConfirm = container.querySelector('#input-reset-confirmation');
  if (inputConfirm) {
    inputConfirm.addEventListener('input', (e) => {
      resetInputValue = e.target.value;
      const btnConfirm = container.querySelector('#btn-confirm-delete-all');
      const isCorrect = resetInputValue.trim().toUpperCase() === 'СБРОС';

      if (btnConfirm) {
        if (isCorrect) {
          btnConfirm.removeAttribute('disabled');
          btnConfirm.classList.remove('btn-disabled');
        } else {
          btnConfirm.setAttribute('disabled', 'true');
          btnConfirm.classList.add('btn-disabled');
        }
      }
    });
  }

  container.querySelector('#btn-confirm-delete-all')?.addEventListener('click', () => {
    if (resetInputValue.trim().toUpperCase() !== 'СБРОС') return;

    isResetModalOpen = false;
    resetInputValue = '';

    resetState();
    showToast('Все данные успешно сброшены', { type: 'info' });
  });
}
