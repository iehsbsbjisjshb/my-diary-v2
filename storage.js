const STORAGE_KEY = 'diary-v2';

export const SCHEDULE_10R_DEFAULT = {
  '1': [
    { subject: 'Разговор о важном', room: '408' },
    { subject: 'Химия', room: '317' },
    { subject: 'Алгебра', room: '408' },
    { subject: 'Геометрия', room: '408' },
    { subject: 'Физика', room: '314' },
    { subject: 'к.физич.яв.на пр.Удм', room: '314' },
    { subject: 'Литература', room: '306' }
  ],
  '2': [
    { subject: 'Англ. язык', room: '302/306' },
    { subject: 'Физика', room: '314' },
    { subject: 'Алгебра', room: '408' },
    { subject: 'Геометрия', room: '408' },
    { subject: 'Русский язык', room: '308' },
    { subject: 'Обществознание', room: '317' },
    { subject: 'Физкультура', room: '' }
  ],
  '3': [
    { subject: 'Англ. язык', room: '302/306' },
    { subject: 'Физика', room: '314' },
    { subject: 'Обществознание', room: '308' },
    { subject: 'ОБЗР', room: '405' },
    { subject: 'к.физич.яв.на пр.Удм', room: '314' },
    { subject: 'Литература', room: '309' },
    { subject: 'к.тр.вопр.математики', room: '408' },
    { subject: 'Инд. проект', room: '408' }
  ],
  '4': [
    { subject: 'Россия-мои горизонты', room: '408' },
    { subject: 'Русский язык', room: '308' },
    { subject: 'Геометрия', room: '408' },
    { subject: 'Алгебра', room: '408' },
    { subject: 'Физкультура', room: '' },
    { subject: 'к.тр.вопр.математики', room: '408' },
    { subject: 'к.черчен.в компас 3D', room: '205' },
    { subject: 'к.черчен.в компас 3D', room: '402' }
  ],
  '5': [
    { subject: 'Англ. язык', room: '304/306' },
    { subject: 'Физика', room: '314' },
    { subject: 'Алгебра', room: '408' },
    { subject: 'Вер. и статистика', room: '408' },
    { subject: 'История', room: '206' },
    { subject: 'Литература', room: '309' }
  ],
  '6': [
    { subject: 'Информатика', room: '302' },
    { subject: 'Биология', room: '313' },
    { subject: 'История', room: '206' },
    { subject: 'Физика', room: '314' },
    { subject: 'География', room: '406' },
    { subject: 'инд.пр/информ', room: '314/302' }
  ],
  '7': []
};

export const DEFAULT_BELLS_WEEKDAY = [
  { number: 1, start: '08:00', end: '08:40' },
  { number: 2, start: '08:50', end: '09:30' },
  { number: 3, start: '09:45', end: '10:25' },
  { number: 4, start: '10:40', end: '11:20' },
  { number: 5, start: '11:35', end: '12:15' },
  { number: 6, start: '12:25', end: '13:05' },
  { number: 7, start: '13:15', end: '13:55' },
  { number: 8, start: '14:05', end: '14:45' }
];

export const DEFAULT_BELLS_SATURDAY = [
  { number: 1, start: '08:00', end: '08:40' },
  { number: 2, start: '08:50', end: '09:30' },
  { number: 3, start: '09:40', end: '10:20' },
  { number: 4, start: '10:30', end: '11:10' },
  { number: 5, start: '11:20', end: '12:00' },
  { number: 6, start: '12:10', end: '12:50' },
  { number: 7, start: '13:00', end: '13:40' }
];

export const DEFAULT_STATE = {
  version: 2,
  updatedAt: new Date().toISOString(),
  goals: [
    { id: 'g1', title: 'Сдать HSK 4+ (китайский, самообучение)', deadline: '2027-05-01' },
    { id: 'g2', title: 'Аттестат 11 класса не ниже 4.0', deadline: '' },
    { id: 'g3', title: 'Грант на языковой год в Китае', deadline: '' }
  ],
  tasks: [],
  homework: [],
  notes: [],
  chinese: {
    dailyGoalMinutes: 30,
    currentDailyGoal: 30,
    lastGoalDate: null,
    maxGoalReached: false,
    wordsLearned: 0,
    wordsTarget: 3245,
    totalMinutes: 0,
    streak: 0,
    lastStudyDate: null,
    history: {},
    groups: []
  },
  schedule: {
    base: JSON.parse(JSON.stringify(SCHEDULE_10R_DEFAULT)),
    overrides: {},
    bells: JSON.parse(JSON.stringify(DEFAULT_BELLS_WEEKDAY)),
    saturdayBells: JSON.parse(JSON.stringify(DEFAULT_BELLS_SATURDAY))
  },
  weekPlan: {
    plannedWeeks: []
  },
  reviews: []
};

const listeners = new Set();

export function updateDynamicDailyGoal(chinese, history = {}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayISO = `${year}-${month}-${day}`;

  let currentGoal = parseInt(chinese?.currentDailyGoal, 10);
  if (!Number.isFinite(currentGoal) || currentGoal <= 0) {
    currentGoal = parseInt(chinese?.dailyGoalMinutes, 10) || 30;
  }

  let lastGoalDate = chinese?.lastGoalDate;
  let maxGoalReached = Boolean(chinese?.maxGoalReached && currentGoal >= 180);

  // Если динамическая цель ещё не инициализировалась датой
  if (!lastGoalDate) {
    return {
      ...(chinese || {}),
      currentDailyGoal: currentGoal,
      dailyGoalMinutes: currentGoal,
      lastGoalDate: todayISO,
      maxGoalReached
    };
  }

  if (lastGoalDate === todayISO) {
    return {
      ...(chinese || {}),
      currentDailyGoal: currentGoal,
      dailyGoalMinutes: currentGoal,
      lastGoalDate: todayISO,
      maxGoalReached
    };
  }

  const parseISO = (str) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const formatISO = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  let curDate = parseISO(lastGoalDate);
  const targetDate = parseISO(todayISO);

  let daysCount = 0;
  while (curDate < targetDate && daysCount < 365) {
    const curISO = formatISO(curDate);
    const studiedMinutes = (history && history[curISO]) || 0;

    if (studiedMinutes >= currentGoal) {
      if (maxGoalReached || currentGoal >= 180) {
        maxGoalReached = true;
        // Колеблется: каждый день рандомно от 150 до 180 минут (2.5 - 3 часа)
        currentGoal = Math.floor(Math.random() * ((180 - 150) / 5 + 1)) * 5 + 150;
      } else {
        currentGoal = Math.min(180, currentGoal + 5);
        if (currentGoal >= 180) {
          maxGoalReached = true;
        }
      }
    } else if (studiedMinutes === 0) {
      currentGoal = Math.max(15, currentGoal - 10);
      if (currentGoal < 150) {
        maxGoalReached = false;
      }
    }

    curDate.setDate(curDate.getDate() + 1);
    daysCount++;
  }

  return {
    ...(chinese || {}),
    currentDailyGoal: currentGoal,
    dailyGoalMinutes: currentGoal,
    lastGoalDate: todayISO,
    maxGoalReached
  };
}

export function parseTaskHomeworkTitle(taskTitle) {
  const str = (taskTitle || '').trim();
  const colonIdx = str.indexOf(':');
  if (colonIdx > 0 && colonIdx < 30) {
    const subject = str.substring(0, colonIdx).trim();
    const title = str.substring(colonIdx + 1).trim() || str;
    return { subject, title };
  }
  return { subject: 'Домашка', title: str };
}

export function syncHomeworkAndTasks(state, prevState = null) {
  if (!state) return state;
  let tasks = Array.isArray(state.tasks) ? state.tasks.map((t) => ({ ...t })) : [];
  let homework = Array.isArray(state.homework) ? state.homework.map((h) => ({ ...h })) : [];

  const prevTasksMap = new Map();
  const prevHwMap = new Map();
  if (prevState) {
    (prevState.tasks || []).forEach((t) => { if (t && t.id) prevTasksMap.set(t.id, t); });
    (prevState.homework || []).forEach((h) => { if (h && h.id) prevHwMap.set(h.id, h); });
  }

  // 1. Обнаружение удалений, если передан предыдущий стейт
  if (prevState) {
    const currentHwIds = new Set(homework.map((h) => h.id));
    prevHwMap.forEach((prevHw, prevHwId) => {
      if (!currentHwIds.has(prevHwId)) {
        const linkedTaskId = prevHw.taskId;
        tasks = tasks.filter((t) => t.id !== linkedTaskId && t.homeworkId !== prevHwId);
      }
    });

    const currentTaskIds = new Set(tasks.map((t) => t.id));
    prevTasksMap.forEach((prevTask, prevTaskId) => {
      if (!currentTaskIds.has(prevTaskId) && prevTask.category === 'homework') {
        const linkedHwId = prevTask.homeworkId;
        homework = homework.filter((h) => h.id !== linkedHwId && h.taskId !== prevTaskId);
      }
    });
  }

  const taskMap = new Map();
  const hwMap = new Map();
  tasks.forEach((t) => { if (t && t.id) taskMap.set(t.id, t); });
  homework.forEach((h) => { if (h && h.id) hwMap.set(h.id, h); });

  // 2. Для каждого элемента домашки проверяем наличие парной задачи
  homework.forEach((hw, idx) => {
    if (!hw) return;
    let pairedTask = hw.taskId ? taskMap.get(hw.taskId) : null;
    if (!pairedTask && hw.id) {
      pairedTask = tasks.find((t) => t && t.homeworkId === hw.id);
    }

    if (!pairedTask) {
      const taskId = hw.taskId || ('t_hw_' + hw.id);
      const title = hw.subject ? `${hw.subject}: ${hw.title}` : hw.title;
      pairedTask = {
        id: taskId,
        title,
        date: hw.dueDate || '',
        time: '',
        duration: 0,
        category: 'homework',
        done: Boolean(hw.done),
        note: '',
        homeworkId: hw.id
      };
      tasks.push(pairedTask);
      taskMap.set(taskId, pairedTask);
      hw.taskId = taskId;
    } else {
      pairedTask.homeworkId = hw.id;
      hw.taskId = pairedTask.id;

      const prevHw = hw.id ? prevHwMap.get(hw.id) : null;
      const prevT = pairedTask.id ? prevTasksMap.get(pairedTask.id) : null;

      if (prevHw && prevT) {
        if (hw.done !== prevHw.done) {
          pairedTask.done = hw.done;
        } else if (pairedTask.done !== prevT.done) {
          hw.done = pairedTask.done;
        } else {
          hw.done = pairedTask.done = Boolean(hw.done || pairedTask.done);
        }

        if (hw.dueDate !== prevHw.dueDate) {
          pairedTask.date = hw.dueDate;
        } else if (pairedTask.date !== prevT.date) {
          hw.dueDate = pairedTask.date;
        }

        if (hw.title !== prevHw.title || hw.subject !== prevHw.subject) {
          pairedTask.title = hw.subject ? `${hw.subject}: ${hw.title}` : hw.title;
        } else if (pairedTask.title !== prevT.title) {
          const parsed = parseTaskHomeworkTitle(pairedTask.title);
          hw.subject = parsed.subject;
          hw.title = parsed.title;
        }
      } else {
        pairedTask.done = hw.done = Boolean(hw.done || pairedTask.done);
        if (hw.dueDate) pairedTask.date = hw.dueDate;
        else if (pairedTask.date) hw.dueDate = pairedTask.date;
      }
    }
  });

  // 3. Для каждой задачи с категорией 'homework' проверяем наличие парной домашки
  tasks = tasks.filter((t) => {
    if (!t) return false;
    if (t.category !== 'homework') {
      if (t.homeworkId) {
        homework = homework.filter((h) => h.id !== t.homeworkId);
        hwMap.delete(t.homeworkId);
        delete t.homeworkId;
      }
      return true;
    }

    let pairedHw = t.homeworkId ? hwMap.get(t.homeworkId) : null;
    if (!pairedHw && t.id) {
      pairedHw = homework.find((h) => h && h.taskId === t.id);
    }

    if (!pairedHw) {
      const hwId = t.homeworkId || ('h_task_' + t.id);
      const parsed = parseTaskHomeworkTitle(t.title || '');
      pairedHw = {
        id: hwId,
        subject: parsed.subject,
        title: parsed.title,
        dueDate: t.date || '',
        done: Boolean(t.done),
        taskId: t.id
      };
      homework.push(pairedHw);
      hwMap.set(hwId, pairedHw);
      t.homeworkId = hwId;
    } else {
      t.homeworkId = pairedHw.id;
      pairedHw.taskId = t.id;
    }
    return true;
  });

  return {
    ...state,
    tasks,
    homework
  };
}

export function getState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = {
        ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {
        ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
        updatedAt: new Date().toISOString()
      };
    }

    const rawBase = (parsed.schedule?.base && typeof parsed.schedule.base === 'object')
      ? parsed.schedule.base
      : DEFAULT_STATE.schedule.base;

    const base = {
      '1': Array.isArray(rawBase['1']) ? rawBase['1'] : [],
      '2': Array.isArray(rawBase['2']) ? rawBase['2'] : [],
      '3': Array.isArray(rawBase['3']) ? rawBase['3'] : [],
      '4': Array.isArray(rawBase['4']) ? rawBase['4'] : [],
      '5': Array.isArray(rawBase['5']) ? rawBase['5'] : [],
      '6': Array.isArray(rawBase['6']) ? rawBase['6'] : [],
      '7': Array.isArray(rawBase['7']) ? rawBase['7'] : []
    };

    // Если базовое расписание пустое — автоматически инициализируем шаблоном 10Р
    const hasLessons = Object.values(base).some((arr) => arr.length > 0);
    if (!hasLessons) {
      base['1'] = JSON.parse(JSON.stringify(SCHEDULE_10R_DEFAULT['1']));
      base['2'] = JSON.parse(JSON.stringify(SCHEDULE_10R_DEFAULT['2']));
      base['3'] = JSON.parse(JSON.stringify(SCHEDULE_10R_DEFAULT['3']));
      base['4'] = JSON.parse(JSON.stringify(SCHEDULE_10R_DEFAULT['4']));
      base['5'] = JSON.parse(JSON.stringify(SCHEDULE_10R_DEFAULT['5']));
      base['6'] = JSON.parse(JSON.stringify(SCHEDULE_10R_DEFAULT['6']));
      base['7'] = [];
    }

    const rawChinese = (parsed.chinese && typeof parsed.chinese === 'object') ? parsed.chinese : {};
    const effectiveChinese = {
      ...DEFAULT_STATE.chinese,
      ...rawChinese,
      groups: Array.isArray(rawChinese.groups) ? rawChinese.groups : [],
      wordsTarget: (rawChinese.wordsTarget === 1200 || !rawChinese.wordsTarget) ? 3245 : rawChinese.wordsTarget,
      currentDailyGoal: rawChinese.currentDailyGoal || rawChinese.dailyGoalMinutes || 30
    };
    const updatedChinese = updateDynamicDailyGoal(effectiveChinese, effectiveChinese.history || {});

    // Синхронизируем обратно в localStorage при изменении цели/даты или миграции
    let needsPersist = false;
    if (parsed.words !== undefined) {
      delete parsed.words;
      needsPersist = true;
    }
    if (
      updatedChinese.lastGoalDate !== rawChinese.lastGoalDate ||
      updatedChinese.currentDailyGoal !== rawChinese.currentDailyGoal ||
      updatedChinese.maxGoalReached !== rawChinese.maxGoalReached ||
      rawChinese.wordsTarget === 1200 ||
      !Array.isArray(rawChinese.groups)
    ) {
      needsPersist = true;
    }

    const { words: _legacyWords, ...cleanParsed } = parsed;

    const initialTasks = Array.isArray(cleanParsed.tasks) ? cleanParsed.tasks : [];
    const initialHw = Array.isArray(cleanParsed.homework) ? cleanParsed.homework : [];
    const synced = syncHomeworkAndTasks({ tasks: initialTasks, homework: initialHw }, null);
    if (synced.tasks.length !== initialTasks.length || synced.homework.length !== initialHw.length) {
      needsPersist = true;
    }

    if (needsPersist) {
      try {
        const toSave = {
          ...parsed,
          chinese: updatedChinese,
          tasks: synced.tasks,
          homework: synced.homework
        };
        delete toSave.words;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {}
    }

    return {
      ...DEFAULT_STATE,
      ...cleanParsed,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      goals: Array.isArray(parsed.goals) ? parsed.goals : DEFAULT_STATE.goals,
      tasks: synced.tasks,
      homework: synced.homework,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      chinese: updatedChinese,
      schedule: {
        ...DEFAULT_STATE.schedule,
        ...(parsed.schedule && typeof parsed.schedule === 'object' ? parsed.schedule : {}),
        base,
        overrides: { ...(parsed.schedule?.overrides && typeof parsed.schedule.overrides === 'object' ? parsed.schedule.overrides : {}) },
        bells: (Array.isArray(parsed.schedule?.bells) && parsed.schedule.bells.length > 0)
          ? parsed.schedule.bells
          : JSON.parse(JSON.stringify(DEFAULT_BELLS_WEEKDAY)),
        saturdayBells: (Array.isArray(parsed.schedule?.saturdayBells) && parsed.schedule.saturdayBells.length > 0)
          ? parsed.schedule.saturdayBells
          : JSON.parse(JSON.stringify(DEFAULT_BELLS_SATURDAY))
      },
      weekPlan: {
        ...DEFAULT_STATE.weekPlan,
        plannedWeeks: Array.isArray(parsed.weekPlan?.plannedWeeks) ? parsed.weekPlan.plannedWeeks : []
      }
    };
  } catch (err) {
    console.error('Ошибка чтения состояния из localStorage:', err);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

export function setState(patch, options = {}) {
  try {
    const current = getState();
    const nextCandidate = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
    const synchronized = syncHomeworkAndTasks(nextCandidate, current);
    const next = {
      ...synchronized,
      updatedAt: (options.preserveUpdatedAt && synchronized.updatedAt)
        ? synchronized.updatedAt
        : new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    listeners.forEach((fn) => {
      try {
        fn(next, options);
      } catch (err) {
        console.error('Ошибка в подписчике state:', err);
      }
    });
    return next;
  } catch (err) {
    console.error('Ошибка записи состояния в localStorage:', err);
    return getState();
  }
}

export function resetState() {
  try {
    const initial = {
      ...JSON.parse(JSON.stringify(DEFAULT_STATE)),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    listeners.forEach((fn) => {
      try {
        fn(initial, { isReset: true });
      } catch (err) {
        console.error('Ошибка в подписчике state при сбросе:', err);
      }
    });
    return initial;
  } catch (err) {
    console.error('Ошибка сброса состояния:', err);
    return getState();
  }
}

export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Доступ из глобальной области для отладки в консоли
if (typeof window !== 'undefined') {
  window.storage = { getState, setState, resetState, onStateChange, updateDynamicDailyGoal, syncHomeworkAndTasks, parseTaskHomeworkTitle, DEFAULT_STATE, SCHEDULE_10R_DEFAULT, DEFAULT_BELLS_WEEKDAY, DEFAULT_BELLS_SATURDAY };
  window.getState = getState;
  window.setState = setState;
  window.resetState = resetState;
}
