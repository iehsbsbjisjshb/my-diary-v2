import { getState, setState } from '../storage.js';
import { showToast } from '../toast.js';

let isAddingNote = false;
let editingNoteId = null;

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

  // Сортировка: свежие сверху
  notes.sort((a, b) => {
    const da = a.created ? new Date(a.created).getTime() : 0;
    const db = b.created ? new Date(b.created).getTime() : 0;
    return db - da;
  });

  container.innerHTML = `
    <div class="notes-screen">
      <div class="notes-header">
        <h1>Заметки (${notes.length})</h1>
        ${
          !isAddingNote
            ? `<button class="btn btn-accent btn-sm" id="btn-open-add-note">+ Новая заметка</button>`
            : ''
        }
      </div>

      <!-- Форма создания новой заметки -->
      ${
        isAddingNote
          ? renderNoteForm({ isNew: true, title: '', text: '' })
          : ''
      }

      <!-- Список заметок -->
      <div class="notes-list">
        ${
          notes.length === 0 && !isAddingNote
            ? `<div class="notes-empty">Заметок пока нет. Нажмите «+ Новая заметка», чтобы создать первую.</div>`
            : notes
                .map((note) => {
                  if (editingNoteId === note.id) {
                    return renderNoteForm({
                      isNew: false,
                      id: note.id,
                      title: note.title,
                      text: note.text
                    });
                  }
                  return renderNoteCard(note);
                })
                .join('')
        }
      </div>
    </div>
  `;

  attachEventListeners(container, state);
}

function renderNoteCard(note) {
  return `
    <div class="note-card" data-note-id="${note.id}">
      <div class="note-card-main note-content-clickable" data-note-id="${note.id}">
        ${note.title ? `<div class="note-title">${escapeHtml(note.title)}</div>` : ''}
        <div class="note-text">${escapeHtml(note.text)}</div>
        <div class="note-date">${formatNoteDate(note.created)}</div>
      </div>
      <div class="note-actions">
        <button class="btn-delete-note" data-delete-note-id="${note.id}" title="Удалить заметку" aria-label="Удалить">✕</button>
      </div>
    </div>
  `;
}

function renderNoteForm(fields) {
  const isTextEmpty = !fields.text || !fields.text.trim();
  return `
    <form class="note-inline-form" id="form-note" data-mode="${fields.isNew ? 'new' : 'edit'}" data-note-id="${fields.id || ''}">
      <input 
        type="text" 
        class="form-input note-title-input" 
        placeholder="Заголовок (опционально)" 
        value="${escapeHtml(fields.title)}" 
      />
      <textarea 
        class="form-input note-textarea" 
        placeholder="Текст заметки *" 
        rows="4" 
        required 
        autofocus
      >${escapeHtml(fields.text)}</textarea>

      <div class="form-actions">
        <button type="submit" class="btn btn-accent btn-sm btn-save-note" ${isTextEmpty ? 'disabled' : ''}>Сохранить</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-note">Отмена</button>
      </div>
    </form>
  `;
}

function attachEventListeners(container, state) {
  // Валидация обязательного поля текста заметки
  const noteTextarea = container.querySelector('.note-textarea');
  const btnSaveNote = container.querySelector('.btn-save-note');
  if (noteTextarea && btnSaveNote) {
    noteTextarea.addEventListener('input', () => {
      btnSaveNote.disabled = !noteTextarea.value.trim();
    });
  }

  // Открытие формы добавления заметки
  container.querySelector('#btn-open-add-note')?.addEventListener('click', () => {
    isAddingNote = true;
    editingNoteId = null;
    render(container, getState());
  });

  // Отмена формы
  container.querySelector('#btn-cancel-note')?.addEventListener('click', () => {
    isAddingNote = false;
    editingNoteId = null;
    render(container, getState());
  });

  // Клик по заметке для редактирования
  container.querySelectorAll('.note-content-clickable').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-note-id');
      editingNoteId = id;
      isAddingNote = false;
      render(container, getState());
    });
  });

  // Кнопка удаления заметки (✕) с confirm
  container.querySelectorAll('.btn-delete-note').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-note-id');
      if (!confirm('Удалить эту заметку?')) return;

      setState((prev) => ({
        ...prev,
        notes: (prev.notes || []).filter((n) => n.id !== id)
      }));
    });
  });

  // Сохранение заметки (новая или редактируемая)
  container.querySelector('#form-note')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const mode = form.getAttribute('data-mode');
    const noteId = form.getAttribute('data-note-id');

    const titleInput = form.querySelector('.note-title-input');
    const textArea = form.querySelector('.note-textarea');

    const title = titleInput.value.trim();
    const text = textArea.value.trim();
    if (!text) return;

    if (mode === 'new') {
      const newNote = {
        id: 'n_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        title,
        text,
        created: new Date().toISOString()
      };

      // Сбрасываем флаг ДО вызова setState
      isAddingNote = false;

      setState((prev) => ({
        ...prev,
        notes: [...(prev.notes || []), newNote]
      }));
      showToast('Сохранено', { type: 'success' });
    } else {
      // Сбрасываем флаг ДО вызова setState
      editingNoteId = null;

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
}
