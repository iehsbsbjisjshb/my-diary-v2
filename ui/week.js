import { getState, setState } from '../storage.js';
import { showToast } from '../toast.js';

let currentMondayDate = getMonday(new Date());
let activeModalTask = null; // null | { isNew: boolean, id?: string, date: string, title: string, time: string, duration: number|string, category: string, note: string }
let mobileSelectedDayIso = null; // null | 'all' | 'YYYY-MM-DD'

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAYS_FULL_RU = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const CATEGORIES = {
  chinese: { label: 'Китайский', className: 'chip-chinese' },
  homework: { label: 'Домашка', className: 'chip-homework' },
  school: { label: 'Школа', className: 'chip-school' },
  personal: { label: 'Личное', className: 'chip-personal' }
};

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

function formatWeekRange(mon, sun) {
  const m1 = mon.getDate();
  const month1 = MONTHS_RU[mon.getMonth()];
  const m2 = sun.getDate();
  const month2 = MONTHS_RU[sun.getMonth()];
  const y1 = mon.getFullYear();
  const y2 = sun.getFullYear();

  if (y1 === y2) {
    if (mon.getMonth() === sun.getMonth()) {
      return `Неделя ${m1} — ${m2} ${month1} ${y1}`;
    }
    return `Неделя ${m1} ${month1} — ${m2} ${month2} ${y1}`;
  }
  return `Неделя ${m1} ${month1} ${y1} — ${m2} ${month2} ${y2}`;
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
  if (window.location.hash.includes('next=1')) {
    currentMondayDate = addDays(getMonday(new Date()), 7);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#/week');
    }
  }

  const todayISO = formatDateISO(new Date());
  const sunday = addDays(currentMondayDate, 6);
  const weekIsoStr = getIsoWeek(currentMondayDate);
  const isWeekPlanned = (state.weekPlan?.plannedWeeks || []).includes(weekIsoStr);

  // Генерируем 7 дней недели
  const days = [];
  let isTodayInCurrentWeek = false;

  for (let i = 0; i < 7; i++) {
    const dayDate = addDays(currentMondayDate, i);
    const dayISO = formatDateISO(dayDate);
    const dayTasks = (state.tasks || []).filter((t) => t.date === dayISO);

    if (dayISO === todayISO) {
      isTodayInCurrentWeek = true;
    }

    dayTasks.sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return (a.title || '').localeCompare(b.title || '');
    });

    days.push({
      date: dayDate,
      iso: dayISO,
      dayNameShort: DAYS_RU[i],
      dayNameFull: DAYS_FULL_RU[i],
      dayOfMonth: dayDate.getDate(),
      monthName: MONTHS_RU[dayDate.getMonth()],
      isToday: dayISO === todayISO,
      tasks: dayTasks
    });
  }

  // Если мобильный выбор еще не установлен: по умолчанию ставим сегодня (если в этой неделе) или понедельник
  if (mobileSelectedDayIso === null) {
    mobileSelectedDayIso = isTodayInCurrentWeek ? todayISO : days[0].iso;
  }

  container.innerHTML = `
    <div class="week-screen">
      <!-- Навигация по неделям -->
      <div class="week-toolbar">
        <div class="week-nav-group">
          <button class="btn btn-nav" id="week-prev" aria-label="Предыдущая неделя" title="Предыдущая неделя">←</button>
          <span class="week-title-range">${formatWeekRange(currentMondayDate, sunday)}</span>
          <button class="btn btn-nav" id="week-next" aria-label="Следующая неделя" title="Следующая неделя">→</button>
        </div>
        <div class="week-toolbar-actions">
          <button class="btn btn-today" id="week-today-btn">Сегодня</button>
          <button class="btn btn-accent btn-sm" id="btn-week-add-task">+ Новая задача</button>
        </div>
      </div>

      <!-- Баннер планирования недели -->
      ${
        !isWeekPlanned
          ? `
          <div class="week-plan-banner">
            <div class="week-plan-info">
              <span class="week-plan-icon">⚠️</span>
              <span>Эта неделя (<strong>${weekIsoStr}</strong>) не спланирована</span>
            </div>
            <button class="btn btn-accent btn-sm" id="btn-mark-week-planned">Отметить как спланированную</button>
          </div>
          `
          : ''
      }

      <!-- Мобильная панель переключения дней -->
      <div class="week-mobile-days-strip">
        <button class="week-day-pill ${mobileSelectedDayIso === 'all' ? 'active' : ''}" data-day-pill="all">
          Все дни
        </button>
        ${days
          .map(
            (d) => `
          <button class="week-day-pill ${mobileSelectedDayIso === d.iso ? 'active' : ''} ${d.isToday ? 'pill-today' : ''}" data-day-pill="${d.iso}">
            <span>${d.dayNameShort} ${d.dayOfMonth}</span>
            ${d.tasks.length > 0 ? `<span class="week-day-pill-badge">${d.tasks.length}</span>` : ''}
          </button>
        `
          )
          .join('')}
      </div>

      <!-- Сетка дней -->
      <div class="week-grid">
        ${days
          .map((day) => {
            const isHiddenOnMobile = mobileSelectedDayIso !== 'all' && mobileSelectedDayIso !== day.iso;
            return `
            <div class="day-col ${day.isToday ? 'day-today' : ''} ${isHiddenOnMobile ? 'day-col-hidden-mobile' : ''}" data-day-iso="${day.iso}">
              <div class="day-header">
                <div class="day-title">
                  <span>${day.dayNameShort.toUpperCase()} ${day.dayOfMonth} ${day.monthName}</span>
                  ${day.isToday ? '<span class="day-today-tag">Сегодня</span>' : ''}
                </div>
                <button class="btn-add-task" data-day-iso="${day.iso}" title="Добавить задачу" aria-label="Добавить задачу">+</button>
              </div>

              <!-- Список задач -->
              <div class="day-task-list" data-day-iso="${day.iso}">
                ${day.tasks
                  .map((task) => renderTaskCardHtml(task))
                  .join('')}
              </div>
            </div>
            `;
          })
          .join('')}
      </div>

      <!-- Модальное окно создания / редактирования задачи -->
      ${activeModalTask ? renderTaskModalHtml(activeModalTask) : ''}
    </div>
  `;

  document.body.classList.toggle('modal-open', Boolean(activeModalTask));
  attachEventListeners(container, state, { todayISO, days });
}

function renderTaskCardHtml(task) {
  const cat = CATEGORIES[task.category] || CATEGORIES.personal;
  const isRepetition = task.category === 'chinese' && (task.title || '').toLowerCase().includes('повторить');
  const timeLabel = task.time
    ? `${escapeHtml(task.time)}${task.duration && task.duration > 0 ? ` (${task.duration} мин)` : ''}`
    : (task.duration && task.duration > 0 ? `${task.duration} мин` : '');

  return `
    <div class="task-card ${task.done ? 'task-done' : ''} ${isRepetition ? 'task-card-repetition' : ''}" 
         data-task-id="${task.id}" 
         data-task-date="${task.date}"
         draggable="true">
      <div class="task-card-main">
        <label class="task-checkbox-label" title="Отметить выполненной">
          <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" ${task.done ? 'checked' : ''}>
          <span class="checkbox-circle"></span>
        </label>
        
        <div class="task-content-clickable" data-task-id="${task.id}">
          <div class="task-title">
            ${isRepetition ? '<span class="repetition-icon" title="Интервальное повторение">🔄</span> ' : ''}${escapeHtml(task.title)}
          </div>
          
          <div class="task-meta-line">
            ${timeLabel ? `<span class="task-time-badge">${timeLabel}</span>` : ''}
            ${
              isRepetition
                ? '<span class="task-chip chip-chinese-repeat">🔄 Повторение</span>'
                : `<span class="task-chip ${cat.className}">${cat.label}</span>`
            }
          </div>

          ${task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ''}
        </div>

        <button class="btn-task-action" data-delete-task-id="${task.id}" title="Удалить задачу" aria-label="Удалить">✕</button>
      </div>
    </div>
  `;
}

function renderTaskModalHtml(fields) {
  const isTitleEmpty = !fields.title || !fields.title.trim();
  return `
    <div class="modal-overlay task-modal-overlay" id="task-modal-overlay">
      <div class="modal-card task-modal-card">
        <div class="modal-header">
          <h3>${fields.isNew ? 'Новая задача' : 'Редактирование задачи'}</h3>
          <button class="modal-close" id="btn-close-task-modal" type="button">✕</button>
        </div>

        <form class="task-modal-form" id="form-task-modal" data-form-mode="${fields.isNew ? 'new' : 'edit'}" data-task-id="${fields.id || ''}">
          <div class="form-group">
            <label class="form-label" for="task-title-input">Название задачи *</label>
            <input 
              type="text" 
              id="task-title-input"
              class="form-input form-title-input" 
              placeholder="Что нужно сделать?" 
              value="${escapeHtml(fields.title)}" 
              required 
              autofocus 
            />
          </div>

          <div class="form-datetime-row">
            <div class="form-group form-col-half">
              <label class="form-label" for="task-date-input">Дата *</label>
              <input 
                type="date" 
                id="task-date-input"
                class="form-input form-task-date-input" 
                value="${fields.date}" 
                required 
              />
            </div>
            <div class="form-group form-col-half">
              <label class="form-label" for="task-time-input">Время (опционально)</label>
              <input 
                type="time" 
                id="task-time-input"
                class="form-input form-time-input" 
                value="${escapeHtml(fields.time || '')}" 
              />
            </div>
          </div>

          <div class="form-datetime-row">
            <div class="form-group form-col-half">
              <label class="form-label" for="task-duration-input">Длительность (минут)</label>
              <input 
                type="number" 
                inputmode="numeric" 
                id="task-duration-input"
                class="form-input form-duration-input" 
                placeholder="например, 30" 
                min="0" 
                step="5" 
                value="${fields.duration || ''}" 
              />
            </div>
            <div class="form-group form-col-half">
              <label class="form-label" for="task-category-select">Категория</label>
              <select id="task-category-select" class="form-input form-category-select">
                <option value="chinese" ${fields.category === 'chinese' ? 'selected' : ''}>Китайский</option>
                <option value="homework" ${fields.category === 'homework' ? 'selected' : ''}>Домашка</option>
                <option value="school" ${fields.category === 'school' ? 'selected' : ''}>Школа</option>
                <option value="personal" ${fields.category === 'personal' || !fields.category ? 'selected' : ''}>Личное</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="task-note-input">Заметка (опционально)</label>
            <input 
              type="text" 
              id="task-note-input"
              class="form-input form-note-input" 
              placeholder="Детали или ссылка" 
              value="${escapeHtml(fields.note || '')}" 
            />
          </div>

          <div class="modal-actions task-modal-actions">
            <button type="button" class="btn btn-secondary btn-cancel-task" id="btn-cancel-task-modal">Отмена</button>
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
  const { todayISO, days } = meta;

  // Мобильная панель переключения дней
  container.querySelectorAll('.week-day-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      mobileSelectedDayIso = pill.getAttribute('data-day-pill');
      render(container, getState());
    });
  });

  // Навигация недели: Назад
  container.querySelector('#week-prev')?.addEventListener('click', () => {
    currentMondayDate = addDays(currentMondayDate, -7);
    activeModalTask = null;
    mobileSelectedDayIso = 'all';
    render(container, getState());
  });

  // Навигация недели: Вперед
  container.querySelector('#week-next')?.addEventListener('click', () => {
    currentMondayDate = addDays(currentMondayDate, 7);
    activeModalTask = null;
    mobileSelectedDayIso = 'all';
    render(container, getState());
  });

  // Навигация недели: Сегодня
  container.querySelector('#week-today-btn')?.addEventListener('click', () => {
    if (window.location.hash.includes('next=1')) {
      window.location.hash = '#/week';
      return;
    }
    currentMondayDate = getMonday(new Date());
    activeModalTask = null;
    mobileSelectedDayIso = todayISO;
    render(container, getState());
  });

  // Кнопка "+ Новая задача" в тулбаре недели
  container.querySelector('#btn-week-add-task')?.addEventListener('click', () => {
    activeModalTask = {
      isNew: true,
      date: mobileSelectedDayIso && mobileSelectedDayIso !== 'all' ? mobileSelectedDayIso : todayISO,
      title: '',
      time: '',
      duration: '',
      category: 'personal',
      note: ''
    };
    render(container, getState());
  });

  // Баннер: отметить неделю как спланированную
  container.querySelector('#btn-mark-week-planned')?.addEventListener('click', () => {
    const isoWeek = getIsoWeek(currentMondayDate);
    setState((prev) => {
      const plannedWeeks = prev.weekPlan?.plannedWeeks || [];
      if (plannedWeeks.includes(isoWeek)) return prev;
      return {
        ...prev,
        weekPlan: {
          ...prev.weekPlan,
          plannedWeeks: [...plannedWeeks, isoWeek]
        }
      };
    });
  });

  // Кнопка "+" в заголовке дня
  container.querySelectorAll('.btn-add-task').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dayIso = btn.getAttribute('data-day-iso');
      activeModalTask = {
        isNew: true,
        date: dayIso,
        title: '',
        time: '',
        duration: '',
        category: 'personal',
        note: ''
      };
      render(container, getState());
    });
  });

  // Клик по задаче для редактирования
  container.querySelectorAll('.task-content-clickable').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = el.getAttribute('data-task-id');
      const task = (state.tasks || []).find((t) => t.id === taskId);
      if (task) {
        activeModalTask = {
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

  // Закрытие модального окна задачи
  const closeTaskModal = () => {
    activeModalTask = null;
    render(container, getState());
  };

  container.querySelector('#btn-close-task-modal')?.addEventListener('click', closeTaskModal);
  container.querySelector('#btn-cancel-task-modal')?.addEventListener('click', closeTaskModal);

  // Закрытие по клику на фон
  let modalMouseDownTarget = null;
  container.querySelectorAll('#task-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('mousedown', (e) => {
      modalMouseDownTarget = e.target;
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && modalMouseDownTarget === overlay) {
        closeTaskModal();
      }
      modalMouseDownTarget = null;
    });
  });

  // Закрытие по Escape
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && activeModalTask) {
      closeTaskModal();
    }
  };
  if (window._weekKeyHandler) window.removeEventListener('keydown', window._weekKeyHandler);
  window._weekKeyHandler = onKeyDown;
  window.addEventListener('keydown', onKeyDown);

  // Валидация заголовка задачи в модалке
  const modalTitleInput = container.querySelector('#task-title-input');
  const modalSaveBtn = container.querySelector('.btn-save-task');
  if (modalTitleInput && modalSaveBtn) {
    modalTitleInput.addEventListener('input', () => {
      modalSaveBtn.disabled = !modalTitleInput.value.trim();
    });
  }

  // Сабмит модалки задачи
  container.querySelector('#form-task-modal')?.addEventListener('submit', (e) => {
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

    activeModalTask = null;

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

  // Чекбокс выполнения задачи
  container.querySelectorAll('.task-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const taskId = checkbox.getAttribute('data-task-id');
      const yesterdayISO = formatDateISO(addDays(new Date(), -1));

      setState((prev) => {
        const targetTask = (prev.tasks || []).find((t) => t.id === taskId);
        const isRepetition = targetTask &&
          targetTask.category === 'chinese' &&
          (targetTask.title || '').toLowerCase().includes('повторить');

        let updatedChinese = { ...(prev.chinese || {}) };
        if (checkbox.checked && isRepetition) {
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
          tasks: (prev.tasks || []).map((t) => (t.id === taskId ? { ...t, done: checkbox.checked } : t))
        };
      });
    });
  });

  // Кнопка удаления задачи (✕) с отменой через Toast (без блокирующего confirm)
  container.querySelectorAll('.btn-task-action').forEach((btn) => {
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

  // Drag-and-Drop
  setupDragAndDrop(container);
}

function setupDragAndDrop(container) {
  container.querySelectorAll('.task-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      const taskId = card.getAttribute('data-task-id');
      e.dataTransfer.setData('text/plain', taskId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      container.querySelectorAll('.day-col').forEach((col) => col.classList.remove('drag-over'));
    });
  });

  container.querySelectorAll('.day-col').forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const targetDate = col.getAttribute('data-day-iso');
      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId || !targetDate) return;

      setState((prev) => {
        const task = (prev.tasks || []).find((t) => t.id === taskId);
        if (!task || task.date === targetDate) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, date: targetDate } : t))
        };
      });
    });
  });
}
