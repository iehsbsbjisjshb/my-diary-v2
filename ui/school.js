import { getState, setState } from '../storage.js';
import { showToast } from '../toast.js';

let activeTab = 'schedule'; // 'schedule' | 'homework'
let activeBaseDay = '1'; // '1' .. '7' для редактирования базового расписания
let activeOverrideDate = ''; // 'YYYY-MM-DD' для редактирования оверрайда
let showOverrideEditor = false;
let reschedulingHwId = null; // id домашки, для которой открыт перенос даты
let isBaseScheduleOpen = false;
let isBellsOpen = false;
let isHwCompletedOpen = false;

const DAYS_SHORT_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAYS_FULL_RU = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function getMonday(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function addDays(d, days) {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  res.setDate(res.getDate() + days);
  return res;
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(str) {
  if (!str) return new Date();
  const parts = str.split('-').map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(str);
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

function getKnownSubjects(state) {
  const subjects = new Set();
  const base = state.schedule?.base || {};
  Object.values(base).forEach((dayLessons) => {
    (dayLessons || []).forEach((l) => {
      if (l.subject && l.subject.trim()) subjects.add(l.subject.trim());
    });
  });
  const overrides = state.schedule?.overrides || {};
  Object.values(overrides).forEach((dayLessons) => {
    (dayLessons || []).forEach((l) => {
      if (l.subject && l.subject.trim()) subjects.add(l.subject.trim());
    });
  });
  (state.homework || []).forEach((h) => {
    if (h.subject && h.subject.trim()) subjects.add(h.subject.trim());
  });
  return Array.from(subjects).sort();
}

export function render(container, state) {
  const now = new Date();
  const todayISO = formatDateISO(now);
  const tomorrowISO = formatDateISO(addDays(now, 1));
  const monday = getMonday(now);

  const schedule = state.schedule || {
    base: { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [] },
    overrides: {},
    bells: []
  };
  const homework = state.homework || [];
  const knownSubjects = getKnownSubjects(state);

  if (!activeOverrideDate) {
    activeOverrideDate = tomorrowISO;
  }

  container.innerHTML = `
    <div class="school-screen">
      <!-- Навигация по вкладкам -->
      <div class="school-tab-bar">
        <button class="school-tab-btn ${activeTab === 'schedule' ? 'active' : ''}" id="tab-schedule-btn">
          📅 Расписание
        </button>
        <button class="school-tab-btn ${activeTab === 'homework' ? 'active' : ''}" id="tab-homework-btn">
          📚 Домашка
          ${homework.filter((h) => !h.done).length > 0 ? `<span class="badge-count">${homework.filter((h) => !h.done).length}</span>` : ''}
        </button>
      </div>

      <!-- Контент вкладки -->
      ${
        activeTab === 'schedule'
          ? renderScheduleTab(schedule, { todayISO, tomorrowISO, monday })
          : renderHomeworkTab(homework, knownSubjects, { todayISO, tomorrowISO })
      }
    </div>
  `;

  attachEventListeners(container, state, { todayISO, tomorrowISO, monday });
}

/* ==========================================================================
   ВКЛАДКА «РАСПИСАНИЕ»
   ========================================================================== */
function renderScheduleTab(schedule, meta) {
  const { todayISO, monday } = meta;

  // Формируем дни текущей недели
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const dayISO = formatDateISO(d);
    const dayKey = String(i + 1);
    const hasOverride = Array.isArray(schedule.overrides?.[dayISO]);
    const lessons = hasOverride ? schedule.overrides[dayISO] : schedule.base?.[dayKey] || [];

    weekDays.push({
      iso: dayISO,
      dayKey,
      dayShort: DAYS_SHORT_RU[i],
      dayOfMonth: d.getDate(),
      monthName: MONTHS_RU[d.getMonth()],
      isToday: dayISO === todayISO,
      hasOverride,
      lessons
    });
  }

  const overrideLessons = schedule.overrides?.[activeOverrideDate] || [];
  const hasCurrentOverride = Array.isArray(schedule.overrides?.[activeOverrideDate]);

  return `
    <div class="schedule-tab-content">
      <!-- Верхняя панель: просмотр и кнопка замены -->
      <div class="schedule-header-actions">
        <div class="schedule-title-block">
          <h2>Текущая неделя</h2>
          <span class="schedule-subtitle">Пн–Вс с учетом замен</span>
        </div>
        <button class="btn btn-accent btn-sm" id="btn-toggle-override-editor">
          ${showOverrideEditor ? 'Закрыть редактор замены' : '✏️ Изменить расписание на дату'}
        </button>
      </div>

      <!-- Редактор замены на выбранную дату (оверрайд) -->
      ${
        showOverrideEditor
          ? `
          <div class="override-editor-box">
            <div class="override-editor-header">
              <h3>Замена расписания на дату</h3>
              <div class="override-date-select">
                <label>Дата:</label>
                <input type="date" class="form-input form-date-input" id="override-date-input" value="${activeOverrideDate}" />
              </div>
            </div>

            <div class="override-status-line">
              ${
                hasCurrentOverride
                  ? `<span class="badge-status-override">На эту дату действует замена (${overrideLessons.length} уроков)</span>`
                  : `<span class="badge-status-base">Действует базовое расписание (замен нет)</span>`
              }
            </div>

            <!-- Список уроков в замене -->
            <div class="override-lessons-list">
              ${
                overrideLessons.length === 0
                  ? `<div class="empty-lessons-msg">Нет уроков в замене. Добавьте первый урок или скопируйте из базы.</div>`
                  : overrideLessons
                      .map(
                        (l, idx) => `
                    <div class="lesson-row">
                      <span class="lesson-num">${idx + 1}</span>
                      <span class="lesson-time">${escapeHtml(l.time || '—')}</span>
                      <span class="lesson-subject">${escapeHtml(l.subject)}</span>
                      <span class="lesson-room">${l.room ? `каб. ${escapeHtml(l.room)}` : ''}</span>
                      <button class="btn-delete-lesson" data-delete-override-idx="${idx}" title="Удалить">✕</button>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>

            <!-- Форма добавления урока в оверрайд -->
            <form class="add-lesson-form" id="form-add-override-lesson">
              <input type="text" class="form-input" id="ov-lesson-time" placeholder="Время (08:00-08:45)" list="bells-list" />
              <input type="text" class="form-input" id="ov-lesson-subject" placeholder="Предмет *" required />
              <input type="text" class="form-input" id="ov-lesson-room" placeholder="Каб." style="max-width: 80px;" />
              <button type="submit" class="btn btn-accent btn-sm">+ Добавить урок</button>
            </form>

            <div class="override-box-actions">
              <button class="btn btn-secondary btn-sm" id="btn-copy-base-to-override">Скопировать из базового</button>
              ${
                hasCurrentOverride
                  ? `<button class="btn btn-danger btn-sm" id="btn-clear-override">Сбросить замену (удалить)</button>`
                  : ''
              }
            </div>
          </div>
          `
          : ''
      }

      <!-- Сетка недели расписания -->
      <div class="schedule-week-grid">
        ${weekDays
          .map(
            (day) => `
          <div class="schedule-day-col ${day.isToday ? 'day-today' : ''}">
            <div class="schedule-day-header">
              <div class="day-header-info">
                <span class="day-weekday">${day.dayShort}</span>
                <span class="day-date">${day.dayOfMonth} ${day.monthName}</span>
              </div>
              ${day.hasOverride ? `<span class="badge-override-tag" title="Расписание заменено">замена</span>` : ''}
            </div>

            <div class="schedule-lesson-list">
              ${
                day.lessons.length === 0
                  ? `<div class="no-lessons">Нет уроков</div>`
                  : day.lessons
                      .map(
                        (l, idx) => `
                    <div class="schedule-lesson-card">
                      <div class="lesson-top-line">
                        <span class="lesson-time-pill">${escapeHtml(l.time || `#${idx + 1}`)}</span>
                        ${l.room ? `<span class="lesson-room-tag">каб. ${escapeHtml(l.room)}</span>` : ''}
                      </div>
                      <div class="lesson-subject-name">${escapeHtml(l.subject)}</div>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>
          </div>
        `
          )
          .join('')}
      </div>

      <!-- Детали: Базовое расписание и Звонки -->
      <div class="schedule-management-blocks">
        <!-- 1. Редактор базового расписания -->
        <details class="school-details" id="details-base-schedule" ${isBaseScheduleOpen ? 'open' : ''}>
          <summary class="school-details-summary">⚙️ Редактор базового расписания (Пн–Вс)</summary>
          <div class="school-details-content">
            <!-- Выбор дня недели для редактирования базы -->
            <div class="base-day-selector">
              ${DAYS_SHORT_RU.map(
                (name, idx) => `
                <button class="btn-base-day ${activeBaseDay === String(idx + 1) ? 'active' : ''}" data-base-day="${idx + 1}">
                  ${name}
                </button>
              `
              ).join('')}
            </div>

            <div class="base-day-editor">
              <h4>${DAYS_FULL_RU[parseInt(activeBaseDay, 10) - 1]} (базовое)</h4>

              <!-- Список уроков базового дня -->
              <div class="base-lessons-list">
                ${
                  (schedule.base?.[activeBaseDay] || []).length === 0
                    ? `<div class="empty-lessons-msg">Нет уроков. Добавьте первый урок ниже:</div>`
                    : (schedule.base[activeBaseDay] || [])
                        .map(
                          (l, idx) => `
                      <div class="lesson-row">
                        <span class="lesson-num">${idx + 1}</span>
                        <span class="lesson-time">${escapeHtml(l.time || '—')}</span>
                        <span class="lesson-subject">${escapeHtml(l.subject)}</span>
                        <span class="lesson-room">${l.room ? `каб. ${escapeHtml(l.room)}` : ''}</span>
                        <button class="btn-delete-lesson" data-delete-base-day="${activeBaseDay}" data-delete-base-idx="${idx}" title="Удалить">✕</button>
                      </div>
                    `
                        )
                        .join('')
                }
              </div>

              <!-- Форма добавления базового урока -->
              <form class="add-lesson-form" id="form-add-base-lesson">
                <input type="text" class="form-input" id="base-lesson-time" placeholder="Время (08:00-08:45)" list="bells-list" />
                <input type="text" class="form-input" id="base-lesson-subject" placeholder="Предмет *" required />
                <input type="text" class="form-input" id="base-lesson-room" placeholder="Каб." style="max-width: 80px;" />
                <button type="submit" class="btn btn-accent btn-sm">+ Урок</button>
              </form>
            </div>
          </div>
        </details>

        <!-- 2. Редактор звонков -->
        <details class="school-details" id="details-bells" ${isBellsOpen ? 'open' : ''}>
          <summary class="school-details-summary">🔔 Редактор звонков (${(schedule.bells || []).length})</summary>
          <div class="school-details-content">
            <div class="bells-list">
              ${
                (schedule.bells || []).length === 0
                  ? `<div class="empty-lessons-msg">Звонки пока не добавлены.</div>`
                  : schedule.bells
                      .map(
                        (b, idx) => `
                    <div class="bell-item">
                      <span class="bell-num">№${b.number || idx + 1}</span>
                      <span class="bell-time">${escapeHtml(b.start)} – ${escapeHtml(b.end)}</span>
                      <button class="btn-delete-bell" data-delete-bell-idx="${idx}" title="Удалить">✕</button>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>

            <!-- Форма добавления звонка -->
            <form class="add-bell-form" id="form-add-bell">
              <input type="number" class="form-input" id="bell-num" placeholder="№" min="1" max="15" value="${(schedule.bells || []).length + 1}" style="max-width: 60px;" required />
              <input type="time" class="form-input" id="bell-start" required />
              <span style="color: var(--text-muted); align-self: center;">–</span>
              <input type="time" class="form-input" id="bell-end" required />
              <button type="submit" class="btn btn-accent btn-sm">+ Добавить</button>
            </form>
          </div>
        </details>
      </div>

      <!-- Datalist для подсказки времени по звонкам -->
      <datalist id="bells-list">
        ${(schedule.bells || []).map((b) => `<option value="${escapeHtml(b.start)}-${escapeHtml(b.end)}">Урок ${b.number}</option>`).join('')}
      </datalist>
    </div>
  `;
}

/* ==========================================================================
   ВКЛАДКА «ДОМАШКА»
   ========================================================================== */
function renderHomeworkTab(homework, knownSubjects, meta) {
  const { todayISO, tomorrowISO } = meta;

  // Разделяем домашку по группам
  const overdueHw = [];
  const todayHw = [];
  const tomorrowHw = [];
  const laterHw = [];
  const completedHw = [];

  homework.forEach((h) => {
    if (h.done) {
      completedHw.push(h);
    } else if (h.dueDate && h.dueDate < todayISO) {
      overdueHw.push(h);
    } else if (h.dueDate === todayISO) {
      todayHw.push(h);
    } else if (h.dueDate === tomorrowISO) {
      tomorrowHw.push(h);
    } else {
      laterHw.push(h);
    }
  });

  return `
    <div class="homework-tab-content">
      <!-- Форма добавления домашки -->
      <form class="add-homework-form" id="form-add-homework">
        <div class="hw-form-row">
          <div class="hw-form-col">
            <label class="form-label">Предмет *</label>
            <input type="text" class="form-input" id="hw-subject" placeholder="Алгебра, Физика..." list="subjects-list" required />
          </div>
          <div class="hw-form-col">
            <label class="form-label">Срок сдачи *</label>
            <input type="date" class="form-input" id="hw-due-date" value="${tomorrowISO}" required />
          </div>
        </div>

        <div class="hw-form-row">
          <div class="hw-form-col hw-col-full">
            <label class="form-label">Задание *</label>
            <input type="text" class="form-input" id="hw-title" placeholder="№123-130, выучить правило..." required />
          </div>
        </div>

        <button type="submit" class="btn btn-accent btn-sm btn-save-hw" id="btn-save-hw" disabled style="align-self: flex-start;">+ Добавить домашку</button>
      </form>

      <!-- Автокомплит предметов -->
      <datalist id="subjects-list">
        ${knownSubjects.map((s) => `<option value="${escapeHtml(s)}"></option>`).join('')}
      </datalist>

      <!-- Списки сгруппированной домашки -->
      <div class="homework-groups">
        <!-- 1. Просрочено -->
        ${
          overdueHw.length > 0
            ? `
            <div class="hw-group hw-group-overdue">
              <div class="hw-group-header">
                <h3>⚠️ Просрочено (${overdueHw.length})</h3>
              </div>
              <div class="hw-list">
                ${overdueHw.map((h) => renderHomeworkItem(h, true)).join('')}
              </div>
            </div>
            `
            : ''
        }

        <!-- 2. Сегодня -->
        <div class="hw-group">
          <div class="hw-group-header">
            <h3>📌 Сегодня (${todayHw.length})</h3>
          </div>
          <div class="hw-list">
            ${
              todayHw.length === 0
                ? `<div class="hw-empty">На сегодня домашки нет</div>`
                : todayHw.map((h) => renderHomeworkItem(h, false)).join('')
            }
          </div>
        </div>

        <!-- 3. Завтра -->
        <div class="hw-group">
          <div class="hw-group-header">
            <h3>⏰ Завтра (${tomorrowHw.length})</h3>
          </div>
          <div class="hw-list">
            ${
              tomorrowHw.length === 0
                ? `<div class="hw-empty">На завтра домашки нет</div>`
                : tomorrowHw.map((h) => renderHomeworkItem(h, false)).join('')
            }
          </div>
        </div>

        <!-- 4. Позже -->
        ${
          laterHw.length > 0
            ? `
            <div class="hw-group">
              <div class="hw-group-header">
                <h3>📅 Позже (${laterHw.length})</h3>
              </div>
              <div class="hw-list">
                ${laterHw.map((h) => renderHomeworkItem(h, false)).join('')}
              </div>
            </div>
            `
            : ''
        }

        <!-- 5. Выполненные -->
        ${
          completedHw.length > 0
            ? `
            <details class="hw-completed-details" id="details-hw-completed" ${isHwCompletedOpen ? 'open' : ''}>
              <summary class="hw-completed-summary">Выполненные задания (${completedHw.length})</summary>
              <div class="hw-list hw-completed-list">
                ${completedHw.map((h) => renderHomeworkItem(h, false)).join('')}
              </div>
            </details>
            `
            : ''
        }
      </div>
    </div>
  `;
}

function renderHomeworkItem(h, isOverdue) {
  const isRescheduling = reschedulingHwId === h.id;

  return `
    <div class="hw-item ${isOverdue ? 'hw-item-overdue' : ''} ${h.done ? 'hw-item-done' : ''}">
      <div class="hw-item-main">
        <label class="task-checkbox-label">
          <input type="checkbox" class="hw-checkbox" data-hw-id="${h.id}" ${h.done ? 'checked' : ''} />
          <span class="checkbox-custom"></span>
        </label>
        <div class="hw-item-body">
          <div class="hw-item-meta">
            <span class="hw-subject-badge">${escapeHtml(h.subject)}</span>
            <span class="hw-due-badge ${isOverdue ? 'due-overdue' : ''}">${escapeHtml(h.dueDate)}</span>
          </div>
          <div class="hw-title ${h.done ? 'hw-title-done' : ''}">${escapeHtml(h.title)}</div>
        </div>
      </div>

      <div class="hw-item-actions">
        <button class="btn btn-secondary btn-sm btn-reschedule" data-hw-id="${h.id}">📅 Перенести</button>
        <button class="btn-delete-hw" data-delete-hw-id="${h.id}" title="Удалить">✕</button>
      </div>

      <!-- Инлайн форма переноса срока -->
      ${
        isRescheduling
          ? `
          <div class="hw-reschedule-box">
            <label>Новая дата:</label>
            <input type="date" class="form-input reschedule-date-input" data-hw-id="${h.id}" value="${h.dueDate}" />
            <button class="btn btn-accent btn-sm btn-save-reschedule" data-hw-id="${h.id}">ОК</button>
            <button class="btn btn-secondary btn-sm btn-cancel-reschedule">Отмена</button>
          </div>
          `
          : ''
      }
    </div>
  `;
}

/* ==========================================================================
   ОБРАБОТЧИКИ СОБЫТИЙ
   ========================================================================== */
function attachEventListeners(container, state, meta) {
  const { todayISO, tomorrowISO, monday } = meta;

  // 1. Переключение вкладок
  container.querySelector('#tab-schedule-btn')?.addEventListener('click', () => {
    activeTab = 'schedule';
    render(container, getState());
  });

  container.querySelector('#tab-homework-btn')?.addEventListener('click', () => {
    activeTab = 'homework';
    render(container, getState());
  });

  if (activeTab === 'schedule') {
    // Кнопка открытия/закрытия редактора оверрайда
    container.querySelector('#btn-toggle-override-editor')?.addEventListener('click', () => {
      showOverrideEditor = !showOverrideEditor;
      render(container, getState());
    });

    // Смена даты оверрайда
    container.querySelector('#override-date-input')?.addEventListener('change', (e) => {
      activeOverrideDate = e.target.value;
      render(container, getState());
    });

    // Добавление урока в оверрайд
    container.querySelector('#form-add-override-lesson')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const time = container.querySelector('#ov-lesson-time').value.trim();
      const subject = container.querySelector('#ov-lesson-subject').value.trim();
      const room = container.querySelector('#ov-lesson-room').value.trim();
      if (!subject || !activeOverrideDate) return;

      setState((prev) => {
        const schedule = prev.schedule || {};
        const overrides = { ...(schedule.overrides || {}) };
        const currentLessons = [...(overrides[activeOverrideDate] || [])];
        currentLessons.push({ time, subject, room });
        overrides[activeOverrideDate] = currentLessons;

        return {
          ...prev,
          schedule: {
            ...schedule,
            overrides
          }
        };
      });
    });

    // Удаление урока из оверрайда
    container.querySelectorAll('[data-delete-override-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-delete-override-idx'), 10);
        setState((prev) => {
          const schedule = prev.schedule || {};
          const overrides = { ...(schedule.overrides || {}) };
          const currentLessons = [...(overrides[activeOverrideDate] || [])];
          currentLessons.splice(idx, 1);
          overrides[activeOverrideDate] = currentLessons;

          return {
            ...prev,
            schedule: {
              ...schedule,
              overrides
            }
          };
        });
      });
    });

    // Скопировать базовое расписание в оверрайд
    container.querySelector('#btn-copy-base-to-override')?.addEventListener('click', () => {
      if (!activeOverrideDate) return;
      const targetDate = parseLocalDate(activeOverrideDate);
      const dayNum = targetDate.getDay() === 0 ? '7' : String(targetDate.getDay());

      setState((prev) => {
        const schedule = prev.schedule || {};
        const baseLessons = schedule.base?.[dayNum] || [];
        const overrides = { ...(schedule.overrides || {}) };
        overrides[activeOverrideDate] = JSON.parse(JSON.stringify(baseLessons));

        return {
          ...prev,
          schedule: {
            ...schedule,
            overrides
          }
        };
      });
    });

    // Сбросить / удалить оверрайд
    container.querySelector('#btn-clear-override')?.addEventListener('click', () => {
      if (!confirm(`Удалить замену на ${activeOverrideDate}?`)) return;
      setState((prev) => {
        const schedule = prev.schedule || {};
        const overrides = { ...(schedule.overrides || {}) };
        delete overrides[activeOverrideDate];

        return {
          ...prev,
          schedule: {
            ...schedule,
            overrides
          }
        };
      });
    });

    // Выбор дня в редакторе базового расписания
    container.querySelectorAll('.btn-base-day').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeBaseDay = btn.getAttribute('data-base-day');
        render(container, getState());
      });
    });

    // Добавление урока в базу
    container.querySelector('#form-add-base-lesson')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const time = container.querySelector('#base-lesson-time').value.trim();
      const subject = container.querySelector('#base-lesson-subject').value.trim();
      const room = container.querySelector('#base-lesson-room').value.trim();
      if (!subject) return;

      setState((prev) => {
        const schedule = prev.schedule || {};
        const base = { ...(schedule.base || {}) };
        const dayLessons = [...(base[activeBaseDay] || [])];
        dayLessons.push({ time, subject, room });
        base[activeBaseDay] = dayLessons;

        return {
          ...prev,
          schedule: {
            ...schedule,
            base
          }
        };
      });
    });

    // Удаление урока из базы
    container.querySelectorAll('[data-delete-base-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dayKey = btn.getAttribute('data-delete-base-day');
        const idx = parseInt(btn.getAttribute('data-delete-base-idx'), 10);

        setState((prev) => {
          const schedule = prev.schedule || {};
          const base = { ...(schedule.base || {}) };
          const dayLessons = [...(base[dayKey] || [])];
          dayLessons.splice(idx, 1);
          base[dayKey] = dayLessons;

          return {
            ...prev,
            schedule: {
              ...schedule,
              base
            }
          };
        });
      });
    });

    // Добавление звонка
    container.querySelector('#form-add-bell')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const number = parseInt(container.querySelector('#bell-num').value, 10);
      const start = container.querySelector('#bell-start').value;
      const end = container.querySelector('#bell-end').value;
      if (!start || !end) return;

      setState((prev) => {
        const schedule = prev.schedule || {};
        const bells = [...(schedule.bells || [])];
        bells.push({ number, start, end });
        bells.sort((a, b) => a.start.localeCompare(b.start));

        return {
          ...prev,
          schedule: {
            ...schedule,
            bells
          }
        };
      });
    });

    // Отслеживание состояния раскрытия деталей расписания
    container.querySelector('#details-base-schedule')?.addEventListener('toggle', (e) => {
      isBaseScheduleOpen = e.target.open;
    });

    container.querySelector('#details-bells')?.addEventListener('toggle', (e) => {
      isBellsOpen = e.target.open;
    });

    // Удаление звонка
    container.querySelectorAll('.btn-delete-bell').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-delete-bell-idx'), 10);
        setState((prev) => {
          const schedule = prev.schedule || {};
          const bells = [...(schedule.bells || [])];
          bells.splice(idx, 1);

          return {
            ...prev,
            schedule: {
              ...schedule,
              bells
            }
          };
        });
      });
    });
  }

  if (activeTab === 'homework') {
    // Валидация полей домашки
    const hwSubjectInput = container.querySelector('#hw-subject');
    const hwTitleInput = container.querySelector('#hw-title');
    const btnSaveHw = container.querySelector('#btn-save-hw');
    if (hwSubjectInput && hwTitleInput && btnSaveHw) {
      const validateHw = () => {
        btnSaveHw.disabled = !hwSubjectInput.value.trim() || !hwTitleInput.value.trim();
      };
      hwSubjectInput.addEventListener('input', validateHw);
      hwTitleInput.addEventListener('input', validateHw);
    }

    // Добавление домашки
    container.querySelector('#form-add-homework')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const subject = container.querySelector('#hw-subject').value.trim();
      const title = container.querySelector('#hw-title').value.trim();
      const dueDate = container.querySelector('#hw-due-date').value;
      if (!subject || !title || !dueDate) return;

      const newHw = {
        id: 'h' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        subject,
        title,
        dueDate,
        done: false
      };

      setState((prev) => ({
        ...prev,
        homework: [...(prev.homework || []), newHw]
      }));

      showToast('Сохранено', { type: 'success' });

      // Сбрасываем поле задания
      const titleInput = container.querySelector('#hw-title');
      if (titleInput) titleInput.value = '';
      if (btnSaveHw) btnSaveHw.disabled = true;
    });

    // Чекбокс домашки
    container.querySelectorAll('.hw-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const id = checkbox.getAttribute('data-hw-id');
        const checked = checkbox.checked;

        setState((prev) => ({
          ...prev,
          homework: (prev.homework || []).map((h) => (h.id === id ? { ...h, done: checked } : h))
        }));
      });
    });

    // Удаление домашки
    container.querySelectorAll('.btn-delete-hw').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-hw-id');
        setState((prev) => ({
          ...prev,
          homework: (prev.homework || []).filter((h) => h.id !== id)
        }));
      });
    });

    // Открытие инлайн-переноса даты
    container.querySelectorAll('.btn-reschedule').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-hw-id');
        reschedulingHwId = reschedulingHwId === id ? null : id;
        render(container, getState());
      });
    });

    // Отмена инлайн-переноса
    container.querySelectorAll('.btn-cancel-reschedule').forEach((btn) => {
      btn.addEventListener('click', () => {
        reschedulingHwId = null;
        render(container, getState());
      });
    });

    // Отслеживание состояния раскрытия выполненных заданий
    container.querySelector('#details-hw-completed')?.addEventListener('toggle', (e) => {
      isHwCompletedOpen = e.target.open;
    });

    // Сохранение нового срока сдачи
    container.querySelectorAll('.btn-save-reschedule').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-hw-id');
        const input = container.querySelector(`.reschedule-date-input[data-hw-id="${id}"]`);
        if (!input || !input.value) return;

        // Сбрасываем id ДО вызова setState, чтобы перерендер закрыл инлайн-форму
        reschedulingHwId = null;

        setState((prev) => ({
          ...prev,
          homework: (prev.homework || []).map((h) => (h.id === id ? { ...h, dueDate: input.value } : h))
        }));
        showToast('Сохранено', { type: 'success' });
      });
    });
  }
}
