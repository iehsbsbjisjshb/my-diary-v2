import { getState, setState } from '../storage.js';
import { showToast } from '../toast.js';

let isEditingReview = false;
let activeModal = null; // 'minutes' | 'words' | null
let isCompletedTasksOpen = false;
let isReviewUserToggled = false;
let isReviewOpen = false;

const CATEGORIES = {
  chinese: { label: 'Китайский', className: 'chip-chinese' },
  homework: { label: 'Домашка', className: 'chip-homework' },
  school: { label: 'Школа', className: 'chip-school' },
  personal: { label: 'Личное', className: 'chip-personal' }
};

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, days) {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  res.setDate(res.getDate() + days);
  return res;
}

function getIsoWeek(d) {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

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
  const now = new Date();
  const todayISO = formatDateISO(now);
  const yesterdayISO = formatDateISO(addDays(now, -1));
  const tomorrowISO = formatDateISO(addDays(now, 1));
  const isEvening = now.getHours() >= 20;

  // 1. Цели и китайский
  const goals = state.goals || [];
  const chinese = state.chinese || {
    dailyGoalMinutes: 60,
    wordsLearned: 0,
    wordsTarget: 1200,
    totalMinutes: 0,
    streak: 0,
    lastStudyDate: null,
    history: {}
  };

  const todayMinutes = (chinese.history && chinese.history[todayISO]) || 0;
  const dailyGoal = chinese.dailyGoalMinutes || 60;
  const minutesPercent = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100));

  // Определение актуального streak (стрик активен, если занимался сегодня или вчера)
  let currentStreak = 0;
  if (chinese.lastStudyDate === todayISO || chinese.lastStudyDate === yesterdayISO) {
    currentStreak = chinese.streak || 0;
  }

  const wordsLearned = chinese.wordsLearned || 0;
  const wordsTarget = chinese.wordsTarget || 0;
  const wordsPercent = wordsTarget > 0 ? Math.min(100, Math.round((wordsLearned / wordsTarget) * 100)) : 0;

  // 2. Просроченные задачи и домашка
  const overdueTasks = (state.tasks || []).filter((t) => t.date && t.date < todayISO && !t.done);
  const overdueHomework = (state.homework || []).filter((h) => h.dueDate && h.dueDate < todayISO && !h.done);
  const hasOverdue = overdueTasks.length > 0 || overdueHomework.length > 0;

  // 3. Задачи и домашка на сегодня
  const todayTasks = (state.tasks || []).filter((t) => t.date === todayISO);
  const todayHomework = (state.homework || []).filter((h) => h.dueDate === todayISO);

  // Объединяем элементы для таймлайна
  const timelineItems = [
    ...todayTasks.map((t) => ({ ...t, itemType: 'task' })),
    ...todayHomework.map((h) => ({
      id: h.id,
      title: `${h.subject ? `${h.subject}: ` : ''}${h.title}`,
      time: '',
      done: h.done,
      category: 'homework',
      itemType: 'homework'
    }))
  ];

  // Сортировка: по времени (если есть), без времени — в конце
  timelineItems.sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    return (a.title || '').localeCompare(b.title || '');
  });

  const activeItems = timelineItems.filter((item) => !item.done);
  const completedItems = timelineItems.filter((item) => item.done);
  const todayDoneCount = completedItems.length;

  // 4. Баннер планирования следующей недели (в Сб/Вс)
  const dayOfWeek = now.getDay(); // 0 - Вс, 6 - Сб
  const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
  let showNextWeekBanner = false;
  let nextIsoWeek = '';
  if (isWeekend) {
    const daysToNextMonday = dayOfWeek === 6 ? 2 : 1;
    const nextMonday = addDays(now, daysToNextMonday);
    nextIsoWeek = getIsoWeek(nextMonday);
    const plannedWeeks = state.weekPlan?.plannedWeeks || [];
    showNextWeekBanner = !plannedWeeks.includes(nextIsoWeek);
  }

  // 5. Разбор дня (reviews)
  const todayReview = (state.reviews || []).find((r) => r.date === todayISO);
  const defaultReviewOpen = isEvening || !!todayReview;
  const currentReviewOpen = isReviewUserToggled ? isReviewOpen : defaultReviewOpen;

  container.innerHTML = `
    <div class="today-screen">
      <!-- 5. Баннер планирования следующей недели (если сб/вс и не спланирована) -->
      ${
        showNextWeekBanner
          ? `
          <div class="week-plan-banner today-weekend-banner">
            <div class="week-plan-info">
              <span class="week-plan-icon">📅</span>
              <span>Спланируй следующую неделю (<strong>${nextIsoWeek}</strong>)</span>
            </div>
            <button class="btn btn-accent btn-sm" id="btn-goto-week-plan">Перейти к планированию</button>
          </div>
          `
          : ''
      }

      <!-- 1. Шапка целей и китайского языка -->
      <section class="today-section goals-chinese-section">
        <div class="goals-card">
          <div class="section-badge">Главные цели</div>
          <ul class="goals-list">
            ${goals
              .map(
                (g, idx) => `
              <li class="goal-item">
                <span class="goal-num">${idx + 1}.</span>
                <span class="goal-title">${escapeHtml(g.title)}</span>
                ${g.deadline ? `<span class="goal-deadline">до ${escapeHtml(g.deadline)}</span>` : ''}
              </li>
            `
              )
              .join('')}
          </ul>
        </div>

        <div class="chinese-widget">
          <div class="chinese-header">
            <div class="streak-badge">
              <span class="fire-icon">🔥</span>
              <span class="streak-text">${currentStreak} ${getPluralDays(currentStreak)} подряд</span>
            </div>
            <button class="btn btn-accent btn-sm" id="btn-open-minutes-modal">+ Отметить занятие</button>
          </div>

          <div class="progress-block">
            <div class="progress-labels">
              <span>Китайский сегодня: <strong>${todayMinutes} / ${dailyGoal} мин</strong></span>
              <span>${minutesPercent}%</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width: ${minutesPercent}%"></div>
            </div>
          </div>

          ${
            wordsTarget > 0
              ? `
            <div class="words-block">
              <div class="words-info">
                <span>Слов: <strong>${wordsLearned} / ${wordsTarget}</strong> (${wordsPercent}%)</span>
                <button class="btn-words-add" id="btn-open-words-modal" title="Добавить выученные слова">+</button>
              </div>
              <div class="progress-bar-track track-words">
                <div class="progress-bar-fill fill-words" style="width: ${wordsPercent}%"></div>
              </div>
            </div>
            `
              : ''
          }
        </div>
      </section>

      <!-- 3. Блок «Просрочено» (если есть невыполненные из прошлого) -->
      ${
        hasOverdue
          ? `
          <section class="today-section overdue-section">
            <div class="overdue-header">
              <span class="overdue-title">⚠️ Просрочено (${overdueTasks.length + overdueHomework.length})</span>
            </div>
            <div class="overdue-list">
              ${overdueTasks
                .map(
                  (t) => `
                <div class="overdue-item" data-id="${t.id}" data-type="task">
                  <div class="overdue-item-info">
                    <span class="overdue-date">${escapeHtml(t.date)}</span>
                    <span class="overdue-title-text">${escapeHtml(t.title)}</span>
                    <span class="task-chip ${CATEGORIES[t.category]?.className || 'chip-personal'}">${CATEGORIES[t.category]?.label || 'Личное'}</span>
                  </div>
                  <div class="overdue-actions">
                    <button class="btn-overdue btn-overdue-done" data-action="done" data-id="${t.id}" data-type="task">✓ Готово</button>
                    <button class="btn-overdue btn-overdue-tomorrow" data-action="tomorrow" data-id="${t.id}" data-type="task">→ На завтра</button>
                    <button class="btn-overdue btn-overdue-delete" data-action="delete" data-id="${t.id}" data-type="task">✕ Удалить</button>
                  </div>
                </div>
              `
                )
                .join('')}

              ${overdueHomework
                .map(
                  (h) => `
                <div class="overdue-item" data-id="${h.id}" data-type="homework">
                  <div class="overdue-item-info">
                    <span class="overdue-date">${escapeHtml(h.dueDate)}</span>
                    <span class="overdue-title-text">${escapeHtml(h.subject ? `${h.subject}: ` : '')}${escapeHtml(h.title)}</span>
                    <span class="task-chip chip-homework">Домашка</span>
                  </div>
                  <div class="overdue-actions">
                    <button class="btn-overdue btn-overdue-done" data-action="done" data-id="${h.id}" data-type="homework">✓ Готово</button>
                    <button class="btn-overdue btn-overdue-tomorrow" data-action="tomorrow" data-id="${h.id}" data-type="homework">→ На завтра</button>
                    <button class="btn-overdue btn-overdue-delete" data-action="delete" data-id="${h.id}" data-type="homework">✕ Удалить</button>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </section>
          `
          : ''
      }

      <!-- 2. Таймлайн дня -->
      <section class="today-section timeline-section">
        <div class="timeline-header">
          <h2>План на сегодня</h2>
          <span class="timeline-date-label">${now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>

        ${
          timelineItems.length === 0
            ? `<div class="timeline-empty">На сегодня пока нет задач. Добавьте их во вкладке «Неделя».</div>`
            : `
            <div class="timeline-list">
              ${activeItems
                .map((item) => renderTimelineCard(item))
                .join('')}
            </div>

            ${
              completedItems.length > 0
                ? `
                <details class="completed-details" id="details-today-completed" ${isCompletedTasksOpen ? 'open' : ''}>
                  <summary class="completed-summary">Показать выполненные (${completedItems.length})</summary>
                  <div class="timeline-list timeline-completed-list">
                    ${completedItems.map((item) => renderTimelineCard(item)).join('')}
                  </div>
                </details>
                `
                : ''
            }
          `
        }
      </section>

      <!-- 4. Блок «Разбор дня» -->
      <section class="today-section review-section">
        <details class="review-details" id="details-today-review" ${currentReviewOpen ? 'open' : ''}>
          <summary class="review-summary">
            <span>✨ Разбор дня ${isEvening ? '(вечерний итог)' : ''}</span>
          </summary>
          
          <div class="review-content">
            <div class="review-stats">
              <span>Сегодня выполнено: <strong>${todayDoneCount}</strong> ${getPluralTasks(todayDoneCount)}</span>
            </div>

            ${
              todayReview && !isEditingReview
                ? `
                <div class="saved-review-box">
                  <div class="saved-review-note">«${escapeHtml(todayReview.note)}»</div>
                  <button class="btn btn-secondary btn-sm" id="btn-edit-review">Изменить</button>
                </div>
                `
                : `
                <form class="review-form" id="review-form">
                  <textarea class="form-input review-textarea" placeholder="1 строка рефлексии (как прошёл день, что удалось?)" rows="2" required>${escapeHtml(todayReview ? todayReview.note : '')}</textarea>
                  <div class="review-form-actions">
                    <button type="submit" class="btn btn-accent btn-sm btn-save-review" ${!todayReview?.note?.trim() ? 'disabled' : ''}>Сохранить</button>
                    ${isEditingReview ? `<button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-edit-review">Отмена</button>` : ''}
                  </div>
                </form>
                `
            }
          </div>
        </details>
      </section>

      <!-- Модальное окно: Отметить занятие (минуты) -->
      ${
        activeModal === 'minutes'
          ? `
          <div class="modal-overlay" id="minutes-modal-overlay">
            <div class="modal-card">
              <div class="modal-header">
                <h3>Отметить занятие китайским</h3>
                <button class="modal-close" id="btn-close-modal">✕</button>
              </div>
              <form id="form-add-minutes">
                <p class="modal-desc">Сколько минут занимались?</p>
                <input type="number" class="form-input modal-input" id="input-minutes" min="1" max="600" value="30" required autofocus />
                <div class="quick-minutes-chips">
                  <button type="button" class="btn-chip" data-min="15">+15 мин</button>
                  <button type="button" class="btn-chip" data-min="30">+30 мин</button>
                  <button type="button" class="btn-chip" data-min="45">+45 мин</button>
                  <button type="button" class="btn-chip" data-min="60">+60 мин</button>
                </div>
                <div class="modal-actions">
                  <button type="submit" class="btn btn-accent" id="btn-submit-minutes">Сохранить</button>
                  <button type="button" class="btn btn-secondary" id="btn-cancel-minutes">Отмена</button>
                </div>
              </form>
            </div>
          </div>
          `
          : ''
      }

      <!-- Модальное окно: Добавить слова -->
      ${
        activeModal === 'words'
          ? `
          <div class="modal-overlay" id="words-modal-overlay">
            <div class="modal-card">
              <div class="modal-header">
                <h3>Выученные слова</h3>
                <button class="modal-close" id="btn-close-modal">✕</button>
              </div>
              <form id="form-add-words">
                <p class="modal-desc">Сколько новых слов выучено?</p>
                <input type="number" class="form-input modal-input" id="input-words" min="1" max="1000" value="10" required autofocus />
                <div class="quick-minutes-chips">
                  <button type="button" class="btn-words-chip" data-words="5">+5 слов</button>
                  <button type="button" class="btn-words-chip" data-words="10">+10 слов</button>
                  <button type="button" class="btn-words-chip" data-words="20">+20 слов</button>
                </div>
                <div class="modal-actions">
                  <button type="submit" class="btn btn-accent" id="btn-submit-words">Добавить</button>
                  <button type="button" class="btn btn-secondary" id="btn-cancel-words">Отмена</button>
                </div>
              </form>
            </div>
          </div>
          `
          : ''
      }
    </div>
  `;

  attachEventListeners(container, state, { todayISO, yesterdayISO, tomorrowISO, todayDoneCount });
}

function renderTimelineCard(item) {
  const cat = CATEGORIES[item.category] || CATEGORIES.personal;
  const isHomework = item.itemType === 'homework';

  return `
    <div class="timeline-card ${item.done ? 'timeline-card-done' : ''}">
      <div class="timeline-time">${escapeHtml(item.time || '—')}</div>
      <div class="timeline-body">
        <label class="task-checkbox-label">
          <input type="checkbox" class="today-item-checkbox" data-id="${item.id}" data-type="${item.itemType}" ${item.done ? 'checked' : ''} />
          <span class="checkbox-custom"></span>
        </label>
        <span class="timeline-title ${item.done ? 'title-done' : ''}">${escapeHtml(item.title)}</span>
        <span class="task-chip ${isHomework ? 'chip-homework' : cat.className}">${isHomework ? 'Домашка' : cat.label}</span>
      </div>
    </div>
  `;
}

function attachEventListeners(container, state, meta) {
  const { todayISO, yesterdayISO, tomorrowISO, todayDoneCount } = meta;

  // 1. Открытие модалки минут
  container.querySelector('#btn-open-minutes-modal')?.addEventListener('click', () => {
    activeModal = 'minutes';
    render(container, getState());
  });

  // Открытие модалки слов
  container.querySelector('#btn-open-words-modal')?.addEventListener('click', () => {
    activeModal = 'words';
    render(container, getState());
  });

  // Закрытие модалок
  const closeModal = () => {
    activeModal = null;
    render(container, getState());
  };

  container.querySelector('#btn-close-modal')?.addEventListener('click', closeModal);
  container.querySelector('#btn-cancel-minutes')?.addEventListener('click', closeModal);
  container.querySelector('#btn-cancel-words')?.addEventListener('click', closeModal);

  // Закрытие модалок по клику на затемненный фон (с защитой от случайного mousedown внутри окна)
  let modalMouseDownTarget = null;
  container.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('mousedown', (e) => {
      modalMouseDownTarget = e.target;
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && modalMouseDownTarget === overlay) {
        closeModal();
      }
      modalMouseDownTarget = null;
    });
  });

  // Быстрые чипы минут
  container.querySelectorAll('.btn-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const input = container.querySelector('#input-minutes');
      if (input) input.value = chip.getAttribute('data-min');
    });
  });

  // Быстрые чипы слов
  container.querySelectorAll('.btn-words-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const input = container.querySelector('#input-words');
      if (input) {
        input.value = chip.getAttribute('data-words');
        const btnSub = container.querySelector('#btn-submit-words');
        if (btnSub) btnSub.disabled = false;
      }
    });
  });

  const inputMinutes = container.querySelector('#input-minutes');
  const btnSubMinutes = container.querySelector('#btn-submit-minutes');
  if (inputMinutes && btnSubMinutes) {
    inputMinutes.addEventListener('input', () => {
      const v = parseInt(inputMinutes.value, 10);
      btnSubMinutes.disabled = isNaN(v) || v <= 0;
    });
  }

  const inputWords = container.querySelector('#input-words');
  const btnSubWords = container.querySelector('#btn-submit-words');
  if (inputWords && btnSubWords) {
    inputWords.addEventListener('input', () => {
      const v = parseInt(inputWords.value, 10);
      btnSubWords.disabled = isNaN(v) || v <= 0;
    });
  }

  // Сабмит минут китайского
  container.querySelector('#form-add-minutes')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = container.querySelector('#input-minutes');
    const minutes = parseInt(input.value, 10);
    if (!minutes || minutes <= 0) return;

    // Сбрасываем модалку ДО вызова setState, чтобы синхронный перерендер отрисовал закрытое состояние
    activeModal = null;

    setState((prev) => {
      const chinese = { ...prev.chinese };
      const history = { ...(chinese.history || {}) };
      const currentTodayMinutes = history[todayISO] || 0;
      history[todayISO] = currentTodayMinutes + minutes;

      let newStreak = chinese.streak || 0;
      if (chinese.lastStudyDate !== todayISO) {
        if (chinese.lastStudyDate === yesterdayISO) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      }

      return {
        ...prev,
        chinese: {
          ...chinese,
          totalMinutes: (chinese.totalMinutes || 0) + minutes,
          streak: newStreak,
          lastStudyDate: todayISO,
          history
        }
      };
    });
    showToast('Сохранено', { type: 'success' });
  });

  // Сабмит слов китайского
  container.querySelector('#form-add-words')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = container.querySelector('#input-words');
    const words = parseInt(input.value, 10);
    if (!words || words <= 0) return;

    // Сбрасываем модалку ДО вызова setState
    activeModal = null;

    setState((prev) => ({
      ...prev,
      chinese: {
        ...prev.chinese,
        wordsLearned: (prev.chinese.wordsLearned || 0) + words
      }
    }));
    showToast('Сохранено', { type: 'success' });
  });

  // 2. Чекбоксы таймлайна (выполнение задачи или домашки)
  container.querySelectorAll('.today-item-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const id = checkbox.getAttribute('data-id');
      const type = checkbox.getAttribute('data-type');
      const checked = checkbox.checked;

      setState((prev) => {
        if (type === 'task') {
          return {
            ...prev,
            tasks: (prev.tasks || []).map((t) => (t.id === id ? { ...t, done: checked } : t))
          };
        } else {
          return {
            ...prev,
            homework: (prev.homework || []).map((h) => (h.id === id ? { ...h, done: checked } : h))
          };
        }
      });
    });
  });

  // 3. Действия с просрочками
  container.querySelectorAll('.btn-overdue').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type');

      if (action === 'delete') {
        if (!confirm('Удалить эту задачу?')) return;
        setState((prev) => {
          if (type === 'task') {
            return { ...prev, tasks: (prev.tasks || []).filter((t) => t.id !== id) };
          } else {
            return { ...prev, homework: (prev.homework || []).filter((h) => h.id !== id) };
          }
        });
      } else if (action === 'done') {
        setState((prev) => {
          if (type === 'task') {
            return {
              ...prev,
              tasks: (prev.tasks || []).map((t) => (t.id === id ? { ...t, done: true } : t))
            };
          } else {
            return {
              ...prev,
              homework: (prev.homework || []).map((h) => (h.id === id ? { ...h, done: true } : h))
            };
          }
        });
      } else if (action === 'tomorrow') {
        setState((prev) => {
          if (type === 'task') {
            return {
              ...prev,
              tasks: (prev.tasks || []).map((t) => (t.id === id ? { ...t, date: tomorrowISO } : t))
            };
          } else {
            return {
              ...prev,
              homework: (prev.homework || []).map((h) => (h.id === id ? { ...h, dueDate: tomorrowISO } : h))
            };
          }
        });
      }
    });
  });

  // Сохранение состояния раскрытия деталей
  container.querySelector('#details-today-completed')?.addEventListener('toggle', (e) => {
    isCompletedTasksOpen = e.target.open;
  });

  container.querySelector('#details-today-review')?.addEventListener('toggle', (e) => {
    isReviewUserToggled = true;
    isReviewOpen = e.target.open;
  });

  // 4. Разбор дня: сохранение / редактирование
  container.querySelector('#btn-edit-review')?.addEventListener('click', () => {
    isEditingReview = true;
    render(container, getState());
  });

  container.querySelector('#btn-cancel-edit-review')?.addEventListener('click', () => {
    isEditingReview = false;
    render(container, getState());
  });

  const reviewTextarea = container.querySelector('.review-textarea');
  const btnSaveReview = container.querySelector('.btn-save-review');
  if (reviewTextarea && btnSaveReview) {
    reviewTextarea.addEventListener('input', () => {
      btnSaveReview.disabled = !reviewTextarea.value.trim();
    });
  }

  container.querySelector('#review-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const textarea = container.querySelector('.review-textarea');
    const note = textarea.value.trim();
    if (!note) return;

    // Сбрасываем флаг ДО вызова setState
    isEditingReview = false;

    setState((prev) => {
      const reviews = [...(prev.reviews || [])];
      const existingIdx = reviews.findIndex((r) => r.date === todayISO);

      const reviewEntry = {
        date: todayISO,
        doneCount: todayDoneCount,
        note
      };

      if (existingIdx >= 0) {
        reviews[existingIdx] = reviewEntry;
      } else {
        reviews.push(reviewEntry);
      }

      return {
        ...prev,
        reviews
      };
    });
    showToast('Сохранено', { type: 'success' });
  });

  // 5. Переход к планированию недели из баннера с фокусом на следующей неделе
  container.querySelector('#btn-goto-week-plan')?.addEventListener('click', () => {
    window.location.hash = '#/week?next=1';
  });
}

function getPluralDays(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

function getPluralTasks(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'задач';
  if (mod10 === 1) return 'задача';
  if (mod10 >= 2 && mod10 <= 4) return 'задачи';
  return 'задач';
}
