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
  let maxGoalReached = Boolean(chinese?.maxGoalReached || currentGoal >= 120);

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
      if (maxGoalReached || currentGoal >= 120) {
        maxGoalReached = true;
        // Колеблется: каждый день рандомно от 90 до 120 минут
        currentGoal = Math.floor(Math.random() * ((120 - 90) / 5 + 1)) * 5 + 90;
      } else {
        currentGoal = Math.min(120, currentGoal + 5);
        if (currentGoal >= 120) {
          maxGoalReached = true;
        }
      }
    } else if (studiedMinutes === 0) {
      currentGoal = Math.max(15, currentGoal - 10);
      if (currentGoal < 90) {
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
      rawChinese.wordsTarget === 1200 ||
      !Array.isArray(rawChinese.groups)
    ) {
      needsPersist = true;
    }

    if (needsPersist) {
      try {
        const toSave = {
          ...parsed,
          chinese: updatedChinese
        };
        delete toSave.words;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {}
    }

    const { words: _legacyWords, ...cleanParsed } = parsed;

    return {
      ...DEFAULT_STATE,
      ...cleanParsed,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      goals: Array.isArray(parsed.goals) ? parsed.goals : DEFAULT_STATE.goals,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      homework: Array.isArray(parsed.homework) ? parsed.homework : [],
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
    const next = {
      ...nextCandidate,
      updatedAt: (options.preserveUpdatedAt && nextCandidate.updatedAt)
        ? nextCandidate.updatedAt
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
  window.storage = { getState, setState, resetState, onStateChange, updateDynamicDailyGoal, DEFAULT_STATE, SCHEDULE_10R_DEFAULT, DEFAULT_BELLS_WEEKDAY, DEFAULT_BELLS_SATURDAY };
  window.getState = getState;
  window.setState = setState;
  window.resetState = resetState;
}
