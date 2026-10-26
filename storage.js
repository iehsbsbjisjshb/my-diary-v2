const STORAGE_KEY = 'diary-v2';

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
    dailyGoalMinutes: 60,
    wordsLearned: 0,
    wordsTarget: 1200,
    totalMinutes: 0,
    streak: 0,
    lastStudyDate: null,
    history: {}
  },
  schedule: {
    base: {
      '1': [],
      '2': [],
      '3': [],
      '4': [],
      '5': [],
      '6': [],
      '7': []
    },
    overrides: {},
    bells: []
  },
  weekPlan: {
    plannedWeeks: []
  },
  reviews: []
};

const listeners = new Set();

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
    return {
      ...DEFAULT_STATE,
      ...parsed,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      goals: Array.isArray(parsed.goals) ? parsed.goals : DEFAULT_STATE.goals,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      homework: Array.isArray(parsed.homework) ? parsed.homework : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      chinese: {
        ...DEFAULT_STATE.chinese,
        ...(parsed.chinese && typeof parsed.chinese === 'object' ? parsed.chinese : {})
      },
      schedule: {
        ...DEFAULT_STATE.schedule,
        ...(parsed.schedule && typeof parsed.schedule === 'object' ? parsed.schedule : {}),
        base: {
          ...DEFAULT_STATE.schedule.base,
          ...(parsed.schedule?.base && typeof parsed.schedule.base === 'object' ? parsed.schedule.base : {})
        },
        overrides: { ...(parsed.schedule?.overrides && typeof parsed.schedule.overrides === 'object' ? parsed.schedule.overrides : {}) },
        bells: Array.isArray(parsed.schedule?.bells) ? parsed.schedule.bells : []
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
  window.storage = { getState, setState, resetState, onStateChange, DEFAULT_STATE };
  window.getState = getState;
  window.setState = setState;
  window.resetState = resetState;
}
