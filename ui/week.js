import { getState, setState } from '../storage.js';
import { showToast } from '../toast.js';

let currentMondayDate = getMonday(new Date());
let activeNewTaskDay = null; // 'YYYY-MM-DD' or null
let editingTaskId = null; // taskId or null

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

function parseLocalDate(str) {
  if (!str) return new Date();
  const parts = str.split('-').map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(str);
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
  for (let i = 0; i < 7; i++) {
    const dayDate = addDays(currentMondayDate, i);
    const dayISO = formatDateISO(dayDate);
    const dayTasks = (state.tasks || []).filter((t) => t.date === dayISO);

    // Сортировка: задачи с time в начале по возрастанию, без time — в конце
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

  container.innerHTML = `
    <div class="week-screen">
      <!-- Навигация по неделям -->
      <div class="week-toolbar">
        <div class="week-nav-group">
          <button class="btn btn-nav" id="week-prev" aria-label="Предыдущая неделя" title="Предыдущая неделя">←</button>
          <span class="week-title-range">${formatWeekRange(currentMondayDate, sunday)}</span>
          <button class="btn btn-nav" id="week-next" aria-label="Следующая неделя" title="Следующая неделя">→</button>
        </div>
        <button class="btn btn-today" id="week-today-btn">Сегодня</button>
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

      <!-- Сетка дней -->
      <div class="week-grid">
        ${days
          .map((day) => {
            const isAddingHere = activeNewTaskDay === day.iso;
            return `
            <div class="day-col ${day.isToday ? 'day-today' : ''}" data-day-iso="${day.iso}">
              <div class="day-header">
                <div class="day-title">
                  <span>${day.dayNameShort.toUpperCase()} ${day.dayOfMonth} ${day.monthName}</span>
                  ${day.isToday ? '<span class="day-today-tag">Сегодня</span>' : ''}
                </div>
                <button class="btn-add-task" data-day-iso="${day.iso}" title="Добавить задачу" aria-label="Добавить задачу">+</button>
              </div>

              <!-- Форма создания задачи -->
              ${
                isAddingHere
                  ? renderTaskFormHtml({
                      isNew: true,
                      date: day.iso,
                      title: '',
                      time: '',
                      duration: '',
                      category: 'personal',
                      note: ''
                    })
                  : ''
              }

              <!-- Список задач -->
              <div class="day-task-list" data-day-iso="${day.iso}">
                ${day.tasks
                  .map((task) => {
                    if (editingTaskId === task.id) {
                      return renderTaskFormHtml({
                        isNew: false,
                        id: task.id,
                        date: task.date,
                        title: task.title,
                        time: task.time,
                        duration: task.duration,
                        category: task.category,
                        note: task.note
                      });
                    }
                    return renderTaskCardHtml(task);
                  })
                  .join('')}
              </div>
            </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;

  // Навешиваем слушатели событий
  attachEventListeners(container, state);
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

function renderTaskFormHtml(fields) {
  const isTitleEmpty = !fields.title || !fields.title.trim();
  return `
    <form class="task-inline-form" data-form-mode="${fields.isNew ? 'new' : 'edit'}" data-task-id="${fields.id || ''}" data-day-iso="${fields.date}">
      <input 
        type="text" 
        class="form-input form-title-input" 
        placeholder="Название задачи *" 
        value="${escapeHtml(fields.title)}" 
        required 
        autofocus 
      />

      <div class="form-datetime-row">
        <input 
          type="date" 
          class="form-input form-task-date-input" 
          value="${fields.date}" 
          required 
        />
        <input 
          type="time" 
          class="form-input form-time-input" 
          value="${escapeHtml(fields.time || '')}" 
          placeholder="Время"
        />
      </div>

      <input 
        type="number" 
        inputmode="numeric" 
        class="form-input form-duration-input" 
        placeholder="Длительность (мин)" 
        min="0" 
        step="5" 
        value="${fields.duration || ''}" 
      />

      <select class="form-input form-category-select">
        <option value="chinese" ${fields.category === 'chinese' ? 'selected' : ''}>Китайский</option>
        <option value="homework" ${fields.category === 'homework' ? 'selected' : ''}>Домашка</option>
        <option value="school" ${fields.category === 'school' ? 'selected' : ''}>Школа</option>
        <option value="personal" ${fields.category === 'personal' || !fields.category ? 'selected' : ''}>Личное</option>
      </select>

      <input 
        type="text" 
        class="form-input form-note-input" 
        placeholder="Заметка (опционально)" 
        value="${escapeHtml(fields.note || '')}" 
      />

      <button type="submit" class="btn btn-save-task" ${isTitleEmpty ? 'disabled' : ''}>Сохранить</button>
      <button type="button" class="btn btn-cancel-task btn-form-cancel">Отмена</button>
    </form>
  `;
}

function attachEventListeners(container, state) {
  // Валидация обязательного поля названия задачи
  container.querySelectorAll('.task-inline-form').forEach((form) => {
    const titleInput = form.querySelector('.form-title-input');
    const saveBtn = form.querySelector('.btn-save-task');
    if (titleInput && saveBtn) {
      titleInput.addEventListener('input', () => {
        saveBtn.disabled = !titleInput.value.trim();
      });
    }
  });

  // Навигация недели: Назад
  container.querySelector('#week-prev')?.addEventListener('click', () => {
    currentMondayDate = addDays(currentMondayDate, -7);
    activeNewTaskDay = null;
    editingTaskId = null;
    render(container, getState());
  });

  // Навигация недели: Вперед
  container.querySelector('#week-next')?.addEventListener('click', () => {
    currentMondayDate = addDays(currentMondayDate, 7);
    activeNewTaskDay = null;
    editingTaskId = null;
    render(container, getState());
  });

  // Навигация недели: Сегодня
  container.querySelector('#week-today-btn')?.addEventListener('click', () => {
    if (window.location.hash.includes('next=1')) {
      window.location.hash = '#/week';
      return;
    }
    currentMondayDate = getMonday(new Date());
    activeNewTaskDay = null;
    editingTaskId = null;
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
      if (activeNewTaskDay === dayIso) {
        activeNewTaskDay = null;
      } else {
        activeNewTaskDay = dayIso;
        editingTaskId = null;
      }
      render(container, getState());
    });
  });

  // Клик по задаче для редактирования
  container.querySelectorAll('.task-content-clickable').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = el.getAttribute('data-task-id');
      editingTaskId = taskId;
      activeNewTaskDay = null;
      render(container, getState());
    });
  });

  // Чекбокс выполнения
  container.querySelectorAll('.task-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const taskId = checkbox.getAttribute('data-task-id');
      const todayISO = formatDateISO(new Date());
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

  // Кнопка удаления задачи (✕)
  container.querySelectorAll('.btn-task-action').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.getAttribute('data-delete-task-id');
      if (!confirm('Удалить эту задачу?')) return;
      setState((prev) => ({
        ...prev,
        tasks: (prev.tasks || []).filter((t) => t.id !== taskId)
      }));
    });
  });

  // Кнопка отмены формы
  container.querySelectorAll('.btn-form-cancel').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      activeNewTaskDay = null;
      editingTaskId = null;
      render(container, getState());
    });
  });

  // Сабмит формы (создание или редактирование)
  container.querySelectorAll('.task-inline-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const mode = form.getAttribute('data-form-mode');
      const dayIso = form.getAttribute('data-day-iso');
      const taskId = form.getAttribute('data-task-id');

      const titleInput = form.querySelector('.form-title-input');
      const dateInput = form.querySelector('.form-task-date-input');
      const timeInput = form.querySelector('.form-time-input');
      const durationInput = form.querySelector('.form-duration-input');
      const categorySelect = form.querySelector('.form-category-select');
      const noteInput = form.querySelector('.form-note-input');

      const title = titleInput.value.trim();
      if (!title) return;

      const targetDate = dateInput ? dateInput.value : dayIso;
      const time = timeInput.value || '';
      const duration = durationInput.value ? parseInt(durationInput.value, 10) : 0;
      const category = categorySelect.value || 'personal';
      const note = noteInput.value.trim();

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
        activeNewTaskDay = null;
        setState((prev) => ({
          ...prev,
          tasks: [...(prev.tasks || []), newTask]
        }));
        showToast('Сохранено', { type: 'success' });
      } else {
        editingTaskId = null;
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
  });

  // Drag-and-Drop
  setupDragAndDrop(container);
}

function setupDragAndDrop(container) {
  // Draggable карточки
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

  // Drop зоны (колонки дней)
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
