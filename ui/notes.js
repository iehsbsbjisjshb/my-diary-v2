import { getState, setState } from '../storage.js';
import { showToast } from '../toast.js';

let activeNoteModal = null; // null | { isNew: boolean, id?: string, title: string, text: string }
let notesSearchQuery = '';

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNoteDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = MONTHS_RU[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hours}:${minutes}`;
}

export function render(container, state) {
  const notes = [...(state.notes || [])];

  notes.sort((a, b) => {
    const da = a.created ? new Date(a.created).getTime() : 0;
    const db = b.created ? new Date(b.created).getTime() : 0;
    return db - da;
  });

  const query = notesSearchQuery.trim().toLowerCase();
  const filteredNotes = query
    ? notes.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(query) ||
          (n.text || '').toLowerCase().includes(query)
      )
    : notes;

  container.innerHTML = `
    <div class="notes-screen">
      <div class="notes-header">
        <h1>Заметки (${notes.length})</h1>
      </div>

      <!-- Тулбар поиска и добавления -->
      <div class="notes-toolbar">
        <div class="notes-search-box">
          <span class="notes-search-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
          <input 
            type="search" 
            class="form-input notes-search-input" 
            id="notes-search-input" 
            placeholder="Поиск по заметкам..." 
            value="${escapeHtml(notesSearchQuery)}" 
          />
          ${
            notesSearchQuery
              ? '<button class="notes-search-clear" id="btn-clear-notes-search" type="button" title="Очистить"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
              : ''
          }
        </div>
        <button class="btn btn-accent btn-sm" id="btn-open-add-note">+ Новая заметка</button>
      </div>

      <!-- Список заметок -->
      <div class="notes-list">
        ${
          filteredNotes.length === 0
            ? query
              ? `<div class="notes-empty">Ничего не найдено по запросу «${escapeHtml(notesSearchQuery)}»</div>`
              : `<div class="notes-empty">Заметок пока нет. Нажмите «+ Новая заметка», чтобы создать первую.</div>`
            : filteredNotes.map((note) => renderNoteCard(note)).join('')
        }
      </div>

      <!-- Модальное окно создания / редактирования заметки -->
      ${activeNoteModal ? renderNoteModalHtml(activeNoteModal) : ''}
    </div>
  `;

  document.body.classList.toggle('modal-open', Boolean(activeNoteModal));
  attachEventListeners(container, state);
}

function renderNoteCard(note) {
  return `
    <div class="note-card" data-note-id="${note.id}">
      <div class="note-card-main note-content-clickable" data-note-id="${note.id}" title="Нажмите для редактирования">
        ${note.title ? `<div class="note-title">${escapeHtml(note.title)}</div>` : ''}
        <div class="note-text">${escapeHtml(note.text)}</div>
        <div class="note-date">${formatNoteDate(note.created)}</div>
      </div>
      <div class="note-actions">
        <button class="btn-delete-note" data-delete-note-id="${note.id}" title="Удалить заметку" aria-label="Удалить"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
    </div>
  `;
}

function renderNoteModalHtml(fields) {
  const isTextEmpty = !fields.text || !fields.text.trim();
  return `
    <div class="modal-overlay" id="note-modal-overlay">
      <div class="modal-card note-modal-card">
        <div class="modal-header">
          <h3>${fields.isNew ? 'Новая заметка' : 'Редактирование заметки'}</h3>
          <button class="modal-close" id="btn-close-note-modal" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        <form class="note-modal-form" id="form-note-modal" data-mode="${fields.isNew ? 'new' : 'edit'}" data-note-id="${fields.id || ''}">
          <div class="form-group">
            <label class="form-label" for="note-title-input">Заголовок (опционально)</label>
            <input 
              type="text" 
              id="note-title-input"
              class="form-input note-title-input" 
              placeholder="О чем заметка?" 
              value="${escapeHtml(fields.title)}" 
              autofocus 
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="note-textarea-input">Текст заметки *</label>
            <textarea 
              id="note-textarea-input"
              class="form-input note-textarea" 
              placeholder="Текст или важные мысли..." 
              rows="6" 
              required
            >${escapeHtml(fields.text)}</textarea>
          </div>

          <div class="modal-actions task-modal-actions">
            <button type="button" class="btn btn-secondary" id="btn-cancel-note-modal">Отмена</button>
            <button type="submit" class="btn btn-accent btn-save-note" ${isTextEmpty ? 'disabled' : ''}>
              ${fields.isNew ? 'Создать' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function attachEventListeners(container, state) {
  // Escape key handler
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && activeNoteModal) {
      activeNoteModal = null;
      render(container, getState());
    }
  };
  if (window._notesKeyHandler) window.removeEventListener('keydown', window._notesKeyHandler);
  window._notesKeyHandler = onKeyDown;
  window.addEventListener('keydown', onKeyDown);

  // Поиск по заметкам
  const searchInput = container.querySelector('#notes-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      notesSearchQuery = e.target.value;
      render(container, getState());
      const nextInput = container.querySelector('#notes-search-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
      }
    });
  }

  // Очистка поиска
  container.querySelector('#btn-clear-notes-search')?.addEventListener('click', () => {
    notesSearchQuery = '';
    render(container, getState());
  });

  // Открытие модалки создания заметки
  container.querySelector('#btn-open-add-note')?.addEventListener('click', () => {
    activeNoteModal = {
      isNew: true,
      title: '',
      text: ''
    };
    render(container, getState());
  });

  // Клик по заметке для редактирования
  container.querySelectorAll('.note-content-clickable').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-note-id');
      const note = (state.notes || []).find((n) => n.id === id);
      if (note) {
        activeNoteModal = {
          isNew: false,
          id: note.id,
          title: note.title,
          text: note.text
        };
        render(container, getState());
      }
    });
  });

  // Закрытие модалки заметки
  const closeNoteModal = () => {
    activeNoteModal = null;
    render(container, getState());
  };

  container.querySelector('#btn-close-note-modal')?.addEventListener('click', closeNoteModal);
  container.querySelector('#btn-cancel-note-modal')?.addEventListener('click', closeNoteModal);

  let modalMouseDownTarget = null;
  container.querySelectorAll('#note-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('mousedown', (e) => {
      modalMouseDownTarget = e.target;
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && modalMouseDownTarget === overlay) {
        closeNoteModal();
      }
      modalMouseDownTarget = null;
    });
  });

  // Валидация текста в модалке заметки
  const noteTextarea = container.querySelector('#note-textarea-input');
  const btnSaveNote = container.querySelector('.btn-save-note');
  if (noteTextarea && btnSaveNote) {
    noteTextarea.addEventListener('input', () => {
      btnSaveNote.disabled = !noteTextarea.value.trim();
    });
  }

  // Сабмит формы заметки
  container.querySelector('#form-note-modal')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const mode = form.getAttribute('data-mode');
    const noteId = form.getAttribute('data-note-id');

    const titleInput = form.querySelector('.note-title-input');
    const textArea = form.querySelector('.note-textarea');

    const title = titleInput.value.trim();
    const text = textArea.value.trim();
    if (!text) return;

    activeNoteModal = null;

    if (mode === 'new') {
      const newNote = {
        id: 'n_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        title,
        text,
        created: new Date().toISOString()
      };

      setState((prev) => ({
        ...prev,
        notes: [...(prev.notes || []), newNote]
      }));
      showToast('Заметка создана', { type: 'success' });
    } else {
      setState((prev) => ({
        ...prev,
        notes: (prev.notes || []).map((n) =>
          n.id === noteId
            ? {
                ...n,
                title,
                text
              }
            : n
        )
      }));
      showToast('Сохранено', { type: 'success' });
    }
  });

  // Кнопка удаления заметки с Undo Toast
  container.querySelectorAll('.btn-delete-note').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-note-id');
      const noteToDelete = (state.notes || []).find((n) => n.id === id);
      if (!noteToDelete) return;

      setState((prev) => ({
        ...prev,
        notes: (prev.notes || []).filter((n) => n.id !== id)
      }));

      showToast('Заметка удалена', {
        duration: 4000,
        action: {
          text: 'Отменить',
          onClick: () => {
            setState((prev) => ({
              ...prev,
              notes: [...(prev.notes || []), noteToDelete]
            }));
            showToast('Заметка восстановлена', { type: 'success' });
          }
        }
      });
    });
  });
}
