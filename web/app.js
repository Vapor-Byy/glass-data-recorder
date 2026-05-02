const CLOUD_ENV = 'YOUR_CLOUD_ENV_ID';
const app = cloudbase.init({ env: CLOUD_ENV });
const db = app.database();

const noteInput = document.getElementById('noteInput');
const addButton = document.getElementById('addButton');
const refreshButton = document.getElementById('refreshButton');
const noteList = document.getElementById('noteList');
const countText = document.getElementById('countText');
const statusText = document.getElementById('statusText');
const emptyState = document.getElementById('emptyState');

async function refreshNotes() {
  statusText.textContent = '正在加载…';
  try {
    const result = await db.collection('notes')
      .orderBy('created_at', 'desc')
      .get();
    renderNotes(result.data);
    statusText.textContent = '已同步最新数据';
  } catch (error) {
    console.error('加载失败', error);
    statusText.textContent = '同步失败，请检查环境 ID 或网络';
  }
}

function renderNotes(notes) {
  noteList.innerHTML = '';
  countText.textContent = `${notes.length} 条`;
  emptyState.style.display = notes.length ? 'none' : 'block';

  notes.forEach((note) => {
    const item = document.createElement('div');
    item.className = 'note-card';

    const content = document.createElement('div');
    content.className = 'note-content';
    content.textContent = note.content;

    const meta = document.createElement('div');
    meta.className = 'note-meta';
    meta.textContent = formatTime(note.created_at);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'note-delete';
    deleteButton.textContent = '删除';
    deleteButton.addEventListener('click', () => deleteNote(note._id));

    item.appendChild(content);
    item.appendChild(meta);
    item.appendChild(deleteButton);
    noteList.appendChild(item);
  });
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function addNote() {
  const content = noteInput.value.trim();
  if (!content) {
    alert('请输入备忘录内容');
    return;
  }

  const now = new Date().toISOString();
  try {
    await db.collection('notes').add({
      data: {
        content,
        created_at: now,
        updated_at: now,
      },
    });
    noteInput.value = '';
    refreshNotes();
  } catch (error) {
    console.error('新增失败', error);
    alert('新增失败，请检查云环境');
  }
}

async function deleteNote(id) {
  if (!confirm('确认删除这条备忘录？')) return;
  try {
    await db.collection('notes').doc(id).remove();
    refreshNotes();
  } catch (error) {
    console.error('删除失败', error);
    alert('删除失败，请稍后重试');
  }
}

addButton.addEventListener('click', addNote);
refreshButton.addEventListener('click', refreshNotes);

refreshNotes();
