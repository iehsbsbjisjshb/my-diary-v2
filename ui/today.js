import { getState, setState } from '../storage.js';
import { showToast } from '../toast.js';

let selectedDate = new Date();
let isEditingReview = false;
let activeModal = null; // 'study' | null
let activeTaskModal = null; // null | { isNew: boolean, id?: string, date: string, title: string, time: string, duration: number|string, category: string, note: string }
let isCompletedTasksOpen = false;
let isReviewUserToggled = false;
let isReviewOpen = false;

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const DAYS_FULL_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS_FULL_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function parseLocalDate(str) {
  if (!str) return new Date();
  const parts = str.split('-').map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(str);
}

function formatScheduleSubtitle(d) {
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const dayName = days[d.getDay()] || '';
  const day = d.getDate();
  const month = months[d.getMonth()] || '';
  return `${dayName}, ${day} ${month}`;
}

function formatShortDate(isoStr) {
  if (!isoStr) return '';
  const parts = isoStr.split('-').map(Number);
  if (parts.length === 3) {
    return `${parts[2]} ${MONTHS_RU[parts[1] - 1] || ''}`;
  }
  return isoStr;
}

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
  const selectedDateISO = formatDateISO(selectedDate);
  const isViewingToday = selectedDateISO === todayISO;
  const yesterdayISO = formatDateISO(addDays(now, -1));
  const tomorrowISO = formatDateISO(addDays(now, 1));
  const isEvening = now.getHours() >= 20;

  let displayDayTitle = 'Распорядок';
  if (isViewingToday) {
    displayDayTitle = 'Сегодня';
  } else if (selectedDateISO === tomorrowISO) {
    displayDayTitle = 'Завтра';
  } else if (selectedDateISO === yesterdayISO) {
    displayDayTitle = 'Вчера';
  } else {
    displayDayTitle = DAYS_FULL_RU[selectedDate.getDay()] || 'Распорядок';
  }

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
  const selectedDayMinutes = (chinese.history && chinese.history[selectedDateISO]) || 0;
  const dailyGoal = chinese.dailyGoalMinutes || 60;
  const minutesPercent = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100));

  let currentStreak = 0;
  if (chinese.lastStudyDate === todayISO || chinese.lastStudyDate === yesterdayISO) {
    currentStreak = chinese.streak || 0;
  }

  const wordsLearned = chinese.wordsLearned || 0;
  const wordsTarget = chinese.wordsTarget || 0;
  const wordsPercent = wordsTarget > 0 ? Math.min(100, Math.round((wordsLearned / wordsTarget) * 100)) : 0;

  // 2. Просроченные задачи и домашка
  const overdueTasks = (state.tasks || []).filter((t) => t && t.date && t.date < todayISO && !t.done);
  const overdueHomework = (state.homework || []).filter((h) => h && h.dueDate && h.dueDate < todayISO && !h.done);
  const hasOverdue = overdueTasks.length > 0 || overdueHomework.length > 0;

  // 3. Задачи и домашка на сегодня
  const todayTasks = (state.tasks || []).filter((t) => t && t.date === selectedDateISO);
  const todayHomework = (state.homework || []).filter((h) => h && h.dueDate === selectedDateISO);

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
  const dayOfWeek = now.getDay();
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
  const todayReview = (state.reviews || []).find((r) => r.date === selectedDateISO);
  const defaultReviewOpen = isEvening || !!todayReview;
  const currentReviewOpen = isReviewUserToggled ? isReviewOpen : defaultReviewOpen;

  container.innerHTML = `
    <div class="today-screen">
      <!-- Баннер планирования следующей недели (если сб/вс) -->
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

      <!-- 2. Блок «Просрочено» -->
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
                    <span class="overdue-date">${escapeHtml(formatShortDate(t.date))}</span>
                    <span class="overdue-title-text">${escapeHtml(t.title)}</span>
                    ${
                      t.category === 'chinese' && (t.title || '').toLowerCase().includes('повторить')
                        ? '<span class="task-chip chip-chinese-repeat">🔄 Повторение</span>'
                        : `<span class="task-chip ${CATEGORIES[t.category]?.className || 'chip-personal'}">${CATEGORIES[t.category]?.label || 'Личное'}</span>`
                    }
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
                    <span class="overdue-date">${escapeHtml(formatShortDate(h.dueDate))}</span>
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

      <!-- 3. Таймлайн дня -->
      <section class="today-section timeline-section">
        <div class="timeline-header">
          <div class="timeline-header-left">
            <h2 class="schedule-day-title">${displayDayTitle}</h2>
            <label class="schedule-day-subtitle-label" title="Нажмите, чтобы выбрать дату">
              <span class="schedule-day-subtitle">${formatScheduleSubtitle(selectedDate)}</span>
              <input type="date" class="schedule-hidden-date-input" id="day-picker-input" value="${selectedDateISO}" />
            </label>
            <div class="schedule-day-nav-arrows">
              <button class="btn-schedule-arrow" id="day-prev" aria-label="Предыдущий день" title="Предыдущий день">‹</button>
              <button class="btn-schedule-arrow" id="day-next" aria-label="Следующий день" title="Следующий день">›</button>
              ${!isViewingToday ? '<button class="btn-schedule-today" id="btn-day-today">Сегодня</button>' : ''}
            </div>
          </div>
          <button class="btn btn-accent btn-sm btn-schedule-add" id="btn-today-add-task">+ Новая задача</button>
        </div>

        ${
          timelineItems.length === 0
            ? `
            <div class="timeline-empty">${isViewingToday ? 'На сегодня пока нет задач.' : `На ${formatShortDate(selectedDateISO)} задач нет.`}</div>
            `
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

      <!-- Модальное окно: Отметить занятие китайским -->
      ${
        activeModal === 'study'
          ? `
          <div class="modal-overlay" id="study-modal-overlay">
            <div class="modal-card">
              <div class="modal-header">
                <h3>🇨🇳 Отметить занятие китайским</h3>
                <button class="modal-close" id="btn-close-modal" type="button">✕</button>
              </div>
              <form id="form-add-study-session">
                <div class="modal-field-group">
                  <label class="form-label" for="input-study-minutes">Минут (всего) *</label>
                  <input 
                    type="number" 
                    inputmode="numeric" 
                    class="form-input modal-input" 
                    id="input-study-minutes" 
                    min="1" 
                    max="600" 
                    value="30" 
                    required 
                    autofocus 
                  />
                  <div class="quick-minutes-chips">
                    <button type="button" class="btn-chip" data-min="15">+15 мин</button>
                    <button type="button" class="btn-chip" data-min="30">+30 мин</button>
                    <button type="button" class="btn-chip" data-min="45">+45 мин</button>
                    <button type="button" class="btn-chip" data-min="60">+60 мин</button>
                  </div>
                </div>

                <div class="modal-field-group" style="margin-top: 10px;">
                  <label class="form-label" for="input-study-words">Новых слов выучено (необязательно)</label>
                  <input 
                    type="number" 
                    inputmode="numeric" 
                    class="form-input modal-input" 
                    id="input-study-words" 
                    min="0" 
                    max="1000" 
                    placeholder="0 (если не учил новые слова)" 
                  />
                  <div class="quick-minutes-chips">
                    <button type="button" class="btn-words-chip" data-words="5">+5 слов</button>
                    <button type="button" class="btn-words-chip" data-words="10">+10 слов</button>
                    <button type="button" class="btn-words-chip" data-words="20">+20 слов</button>
                  </div>
                  <p class="modal-hint">🔄 При вводе слов автоматически создадутся задачи на повторение на завтра (+1), через 3 и через 7 дней.</p>
                </div>

                <div class="modal-actions" style="margin-top: 16px;">
                  <button type="submit" class="btn btn-accent" id="btn-submit-study">Сохранить</button>
                  <button type="button" class="btn btn-secondary" id="btn-cancel-study">Отмена</button>
                </div>
              </form>
            </div>
          </div>
          `
          : ''
      }

      <!-- Модальное окно: Создание / Редактирование задачи на Сегодня -->
      ${activeTaskModal ? renderTodayTaskModalHtml(activeTaskModal) : ''}
    </div>
  `;

  document.body.classList.toggle('modal-open', Boolean(activeModal || activeTaskModal));
  attachEventListeners(container, state, { todayISO, selectedDateISO, isViewingToday, yesterdayISO, tomorrowISO, todayDoneCount });
}

function renderTimelineCard(item) {
  const cat = CATEGORIES[item.category] || CATEGORIES.personal;
  const isHomework = item.itemType === 'homework';
  const isRepetition = item.category === 'chinese' && (item.title || '').toLowerCase().includes('повторить');

  return `
    <div class="timeline-card ${item.done ? 'timeline-card-done' : ''} ${isRepetition ? 'timeline-card-repetition' : ''}">
      <div class="timeline-time">${escapeHtml(item.time || '—')}</div>
      <div class="timeline-body ${!isHomework ? 'timeline-body-clickable' : ''}" data-task-id="${item.id}">
        <label class="task-checkbox-label" title="Отметить выполненной">
          <input type="checkbox" class="today-item-checkbox" data-id="${item.id}" data-type="${item.itemType}" ${item.done ? 'checked' : ''} />
          <span class="checkbox-circle"></span>
        </label>
        <span class="timeline-title ${item.done ? 'title-done' : ''}">
          ${isRepetition ? '<span class="repetition-icon" title="Интервальное повторение">🔄</span> ' : ''}${escapeHtml(item.title)}
        </span>
        ${
          isRepetition
            ? '<span class="task-chip chip-chinese-repeat">🔄 Повторение</span>'
            : `<span class="task-chip ${isHomework ? 'chip-homework' : cat.className}">${isHomework ? 'Домашка' : cat.label}</span>`
        }
      </div>
      ${
        !isHomework
          ? `<button class="btn-task-action btn-timeline-delete" data-delete-task-id="${item.id}" title="Удалить задачу" aria-label="Удалить">✕</button>`
          : ''
      }
    </div>
  `;
}

function renderTodayTaskModalHtml(fields) {
  const isTitleEmpty = !fields.title || !fields.title.trim();
  return `
    <div class="modal-overlay task-modal-overlay" id="today-task-modal-overlay">
      <div class="modal-card task-modal-card">
        <div class="modal-header">
          <h3>${fields.isNew ? 'Новая задача на сегодня' : 'Редактирование задачи'}</h3>
          <button class="modal-close" id="btn-close-today-task-modal" type="button">✕</button>
        </div>

        <form class="task-modal-form" id="form-today-task-modal" data-form-mode="${fields.isNew ? 'new' : 'edit'}" data-task-id="${fields.id || ''}">
          <div class="form-group">
            <label class="form-label" for="today-task-title-input">Название задачи *</label>
            <input 
              type="text" 
              id="today-task-title-input"
              class="form-input form-title-input" 
              placeholder="Что нужно сделать?" 
              value="${escapeHtml(fields.title)}" 
              required 
              autofocus 
            />
          </div>

          <div class="form-datetime-row">
            <div class="form-group form-col-half">
              <label class="form-label" for="today-task-date-input">Дата *</label>
              <input 
                type="date" 
                id="today-task-date-input"
                class="form-input form-task-date-input" 
                value="${fields.date}" 
                required 
              />
            </div>
            <div class="form-group form-col-half">
              <label class="form-label" for="today-task-time-input">Время (опционально)</label>
              <input 
                type="time" 
                id="today-task-time-input"
                class="form-input form-time-input" 
                value="${escapeHtml(fields.time || '')}" 
              />
            </div>
          </div>

          <div class="form-datetime-row">
            <div class="form-group form-col-half">
              <label class="form-label" for="today-task-duration-input">Длительность (минут)</label>
              <input 
                type="number" 
                inputmode="numeric" 
                id="today-task-duration-input"
                class="form-input form-duration-input" 
                placeholder="например, 30" 
                min="0" 
                step="5" 
                value="${fields.duration || ''}" 
              />
            </div>
            <div class="form-group form-col-half">
              <label class="form-label" for="today-task-category-select">Категория</label>
              <select id="today-task-category-select" class="form-input form-category-select">
                <option value="chinese" ${fields.category === 'chinese' ? 'selected' : ''}>Китайский</option>
                <option value="homework" ${fields.category === 'homework' ? 'selected' : ''}>Домашка</option>
                <option value="school" ${fields.category === 'school' ? 'selected' : ''}>Школа</option>
                <option value="personal" ${fields.category === 'personal' || !fields.category ? 'selected' : ''}>Личное</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="today-task-note-input">Заметка (опционально)</label>
            <input 
              type="text" 
              id="today-task-note-input"
              class="form-input form-note-input" 
              placeholder="Детали или ссылка" 
              value="${escapeHtml(fields.note || '')}" 
            />
          </div>

          <div class="modal-actions task-modal-actions">
            <button type="button" class="btn btn-secondary btn-cancel-task" id="btn-cancel-today-task-modal">Отмена</button>
            <button type="submit" class="btn btn-accent btn-save-task" ${isTitleEmpty ? 'disabled' : ''}>
              ${fields.isNew ? 'Создать' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function attachEventListeners(container, state, meta) {
  const { todayISO, selectedDateISO, isViewingToday, yesterdayISO, tomorrowISO, todayDoneCount } = meta;

  // Навигация по дням: Предыдущий день
  container.querySelector('#day-prev')?.addEventListener('click', () => {
    selectedDate = addDays(selectedDate, -1);
    render(container, getState());
  });

  // Навигация по дням: Следующий день
  container.querySelector('#day-next')?.addEventListener('click', () => {
    selectedDate = addDays(selectedDate, 1);
    render(container, getState());
  });

  // Навигация по дням: Вернуться на Сегодня
  container.querySelector('#btn-day-today')?.addEventListener('click', () => {
    selectedDate = new Date();
    render(container, getState());
  });

  // Навигация по дням: Выбор даты через встроенный datepicker
  container.querySelector('#day-picker-input')?.addEventListener('change', (e) => {
    if (e.target.value) {
      selectedDate = parseLocalDate(e.target.value);
      render(container, getState());
    }
  });

  // Escape key handler
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (activeModal || activeTaskModal) {
        activeModal = null;
        activeTaskModal = null;
        render(container, getState());
      }
    }
  };
  if (window._todayKeyHandler) window.removeEventListener('keydown', window._todayKeyHandler);
  window._todayKeyHandler = onKeyDown;
  window.addEventListener('keydown', onKeyDown);

  // Кнопка "+ Новая задача" на сегодня
  const openNewTaskModal = () => {
    activeTaskModal = {
      isNew: true,
      date: selectedDateISO,
      title: '',
      time: '',
      duration: '',
      category: 'personal',
      note: ''
    };
    render(container, getState());
  };

  container.querySelector('#btn-today-add-task')?.addEventListener('click', openNewTaskModal);

  // Клик по задаче в таймлайне для редактирования
  container.querySelectorAll('.timeline-body-clickable').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.task-checkbox-label')) return;
      const taskId = el.getAttribute('data-task-id');
      const task = (state.tasks || []).find((t) => t.id === taskId);
      if (task) {
        activeTaskModal = {
          isNew: false,
          id: task.id,
          date: task.date,
          title: task.title,
          time: task.time,
          duration: task.duration,
          category: task.category,
          note: task.note
        };
        render(container, getState());
      }
    });
  });

  // Закрытие модалки задачи на сегодня
  const closeTodayTaskModal = () => {
    activeTaskModal = null;
    render(container, getState());
  };

  container.querySelector('#btn-close-today-task-modal')?.addEventListener('click', closeTodayTaskModal);
  container.querySelector('#btn-cancel-today-task-modal')?.addEventListener('click', closeTodayTaskModal);

  // Закрытие модалки задачи по клику на фон
  let taskModalDownTarget = null;
  container.querySelectorAll('#today-task-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('mousedown', (e) => {
      taskModalDownTarget = e.target;
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && taskModalDownTarget === overlay) {
        closeTodayTaskModal();
      }
      taskModalDownTarget = null;
    });
  });

  // Валидация заголовка задачи в модалке
  const todayTitleInput = container.querySelector('#today-task-title-input');
  const todaySaveBtn = container.querySelector('.btn-save-task');
  if (todayTitleInput && todaySaveBtn) {
    todayTitleInput.addEventListener('input', () => {
      todaySaveBtn.disabled = !todayTitleInput.value.trim();
    });
  }

  // Сабмит формы создания/редактирования задачи на сегодня
  container.querySelector('#form-today-task-modal')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const mode = form.getAttribute('data-form-mode');
    const taskId = form.getAttribute('data-task-id');

    const titleInput = form.querySelector('.form-title-input');
    const dateInput = form.querySelector('.form-task-date-input');
    const timeInput = form.querySelector('.form-time-input');
    const durationInput = form.querySelector('.form-duration-input');
    const categorySelect = form.querySelector('.form-category-select');
    const noteInput = form.querySelector('.form-note-input');

    const title = titleInput.value.trim();
    if (!title) return;

    const targetDate = dateInput ? dateInput.value : todayISO;
    const time = timeInput.value || '';
    const duration = durationInput.value ? parseInt(durationInput.value, 10) : 0;
    const category = categorySelect.value || 'personal';
    const note = noteInput.value.trim();

    activeTaskModal = null;

    if (mode === 'new') {
      const newTask = {
        id: 't' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        title,
        date: targetDate,
        time,
        duration,
        category,
        done: false,
        note
      };
      setState((prev) => ({
        ...prev,
        tasks: [...(prev.tasks || []), newTask]
      }));
      showToast('Задача создана', { type: 'success' });
    } else {
      setState((prev) => ({
        ...prev,
        tasks: (prev.tasks || []).map((t) =>
          t.id === taskId
            ? {
                ...t,
                title,
                date: targetDate,
                time,
                duration,
                category,
                note
              }
            : t
        )
      }));
      showToast('Сохранено', { type: 'success' });
    }
  });

  // Удаление задачи из таймлайна с Undo Toast
  container.querySelectorAll('.btn-timeline-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.getAttribute('data-delete-task-id');
      const taskToDelete = (state.tasks || []).find((t) => t.id === taskId);
      if (!taskToDelete) return;

      setState((prev) => ({
        ...prev,
        tasks: (prev.tasks || []).filter((t) => t.id !== taskId)
      }));

      showToast('Задача удалена', {
        duration: 4000,
        action: {
          text: 'Отменить',
          onClick: () => {
            setState((prev) => ({
              ...prev,
              tasks: [...(prev.tasks || []), taskToDelete]
            }));
            showToast('Задача восстановлена', { type: 'success' });
          }
        }
      });
    });
  });

  // 1. Открытие модалки занятия китайским
  container.querySelector('#btn-open-minutes-modal')?.addEventListener('click', () => {
    activeModal = 'study';
    render(container, getState());
  });

  // Закрытие модалки занятия китайским
  const closeModal = () => {
    activeModal = null;
    render(container, getState());
  };

  container.querySelector('#btn-close-modal')?.addEventListener('click', closeModal);
  container.querySelector('#btn-cancel-study')?.addEventListener('click', closeModal);

  let modalMouseDownTarget = null;
  container.querySelectorAll('#study-modal-overlay').forEach((overlay) => {
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

  // Чипы минут
  container.querySelectorAll('.btn-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const input = container.querySelector('#input-study-minutes');
      if (input) {
        input.value = chip.getAttribute('data-min');
        const btnSub = container.querySelector('#btn-submit-study');
        if (btnSub) btnSub.disabled = false;
      }
    });
  });

  // Чипы слов
  container.querySelectorAll('.btn-words-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const input = container.querySelector('#input-study-words');
      if (input) {
        input.value = chip.getAttribute('data-words');
      }
    });
  });

  const inputMinutes = container.querySelector('#input-study-minutes');
  const btnSubStudy = container.querySelector('#btn-submit-study');
  if (inputMinutes && btnSubStudy) {
    inputMinutes.addEventListener('input', () => {
      const v = parseInt(inputMinutes.value, 10);
      btnSubStudy.disabled = isNaN(v) || v <= 0;
    });
  }

  // Сабмит формы занятия китайским
  container.querySelector('#form-add-study-session')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const minutesInput = container.querySelector('#input-study-minutes');
    const wordsInput = container.querySelector('#input-study-words');

    const minutes = parseInt(minutesInput.value, 10);
    if (!minutes || minutes <= 0) return;

    const words = wordsInput.value ? parseInt(wordsInput.value, 10) : 0;
    activeModal = null;

    setState((prev) => {
      const chinese = { ...(prev.chinese || {}) };
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

      let updatedTasks = [...(prev.tasks || [])];
      if (words > 0) {
        const nowObj = new Date();
        const dayStr = String(nowObj.getDate()).padStart(2, '0');
        const monthStr = String(nowObj.getMonth() + 1).padStart(2, '0');
        const noteDateStr = `${dayStr}.${monthStr}`;
        const wordDecl = getPluralWords(words);
        const taskTitle = `Китайский: повторить ${words} ${wordDecl}`;
        const taskNote = `Выучены ${noteDateStr}`;

        const repetitionOffsets = [1, 3, 7];
        const newRepetitionTasks = repetitionOffsets.map((offsetDays) => {
          const targetDateISO = formatDateISO(addDays(nowObj, offsetDays));
          return {
            id: 't' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6) + offsetDays,
            title: taskTitle,
            category: 'chinese',
            date: targetDateISO,
            time: '',
            duration: 15,
            done: false,
            note: taskNote
          };
        });

        updatedTasks = [...updatedTasks, ...newRepetitionTasks];
      }

      return {
        ...prev,
        chinese: {
          ...chinese,
          totalMinutes: (chinese.totalMinutes || 0) + minutes,
          wordsLearned: (chinese.wordsLearned || 0) + (words > 0 ? words : 0),
          streak: newStreak,
          lastStudyDate: todayISO,
          history
        },
        tasks: updatedTasks
      };
    });

    showToast(words > 0 ? 'Занятие сохранено! Создано 3 задачи на повторение' : 'Занятие сохранено', { type: 'success' });
  });

  // Чекбоксы таймлайна
  container.querySelectorAll('.today-item-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const id = checkbox.getAttribute('data-id');
      const type = checkbox.getAttribute('data-type');
      const checked = checkbox.checked;

      setState((prev) => {
        if (type === 'task') {
          const targetTask = (prev.tasks || []).find((t) => t.id === id);
          const isRepetition = targetTask &&
            targetTask.category === 'chinese' &&
            (targetTask.title || '').toLowerCase().includes('повторить');

          let updatedChinese = { ...(prev.chinese || {}) };
          if (checked && isRepetition) {
            if (updatedChinese.lastStudyDate !== todayISO) {
              const newStreak = (updatedChinese.lastStudyDate === yesterdayISO)
                ? (updatedChinese.streak || 0) + 1
                : 1;
              updatedChinese.streak = newStreak;
              updatedChinese.lastStudyDate = todayISO;
            }
          }

          return {
            ...prev,
            chinese: updatedChinese,
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

  // Действия с просрочками с отменой через Toast
  container.querySelectorAll('.btn-overdue').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type');

      if (action === 'delete') {
        const itemToDelete = type === 'task'
          ? (state.tasks || []).find((t) => t.id === id)
          : (state.homework || []).find((h) => h.id === id);

        if (!itemToDelete) return;

        setState((prev) => {
          if (type === 'task') {
            return { ...prev, tasks: (prev.tasks || []).filter((t) => t.id !== id) };
          } else {
            return { ...prev, homework: (prev.homework || []).filter((h) => h.id !== id) };
          }
        });

        showToast('Просроченная задача удалена', {
          duration: 4000,
          action: {
            text: 'Отменить',
            onClick: () => {
              setState((prev) => {
                if (type === 'task') {
                  return { ...prev, tasks: [...(prev.tasks || []), itemToDelete] };
                } else {
                  return { ...prev, homework: [...(prev.homework || []), itemToDelete] };
                }
              });
              showToast('Восстановлено', { type: 'success' });
            }
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
        showToast('Перенесено на завтра', { type: 'info' });
      }
    });
  });

  // Детали раскрытия
  container.querySelector('#details-today-completed')?.addEventListener('toggle', (e) => {
    isCompletedTasksOpen = e.target.open;
  });

  container.querySelector('#details-today-review')?.addEventListener('toggle', (e) => {
    isReviewUserToggled = true;
    isReviewOpen = e.target.open;
  });

  // Разбор дня: сохранение / редактирование
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

    isEditingReview = false;

    setState((prev) => {
      const reviews = [...(prev.reviews || [])];
      const existingIdx = reviews.findIndex((r) => r.date === selectedDateISO);

      const reviewEntry = {
        date: selectedDateISO,
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

    showToast('Итог дня сохранён', { type: 'success' });
  });

  container.querySelector('#btn-goto-week-plan')?.addEventListener('click', () => {
    window.location.hash = '#/week?next=1';
  });
}

function getPluralDays(n) {
  const abs = Math.abs(n) % 100;
  const rem = abs % 10;
  if (abs > 10 && abs < 20) return 'дней';
  if (rem > 1 && rem < 5) return 'дня';
  if (rem === 1) return 'день';
  return 'дней';
}

function getPluralWords(n) {
  const abs = Math.abs(n) % 100;
  const rem = abs % 10;
  if (abs > 10 && abs < 20) return 'слов';
  if (rem > 1 && rem < 5) return 'слова';
  if (rem === 1) return 'слово';
  return 'слов';
}

function getPluralTasks(n) {
  const abs = Math.abs(n) % 100;
  const rem = abs % 10;
  if (abs > 10 && abs < 20) return 'задач';
  if (rem > 1 && rem < 5) return 'задачи';
  if (rem === 1) return 'задача';
  return 'задач';
}
