const CLOUD_ENV = 'cloud1-d8gzx0xvwbed1f1f4';
const NOTES = 'notes';
const PROJECTS = 'projects';
const POLL_INTERVAL = 4000;

let app = null;
let db = null;

const state = {
    mode: 'temporary',
    notes: [],
    projects: [],
    query: '',
    selectedProjectId: '',
    theme: 'day',
    pollTimer: null,
};

const els = {
    syncStatus: document.getElementById('syncStatus'),
    themeToggle: document.getElementById('themeToggle'),
    searchInput: document.getElementById('searchInput'),
    temporaryCount: document.getElementById('temporaryCount'),
    longtermCount: document.getElementById('longtermCount'),
    projectCount: document.getElementById('projectCount'),
    temporaryPanel: document.getElementById('temporaryPanel'),
    projectsPanel: document.getElementById('projectsPanel'),
    temporaryInput: document.getElementById('temporaryInput'),
    addTemporaryButton: document.getElementById('addTemporaryButton'),
    temporaryList: document.getElementById('temporaryList'),
    temporaryEmpty: document.getElementById('temporaryEmpty'),
    projectInput: document.getElementById('projectInput'),
    addProjectButton: document.getElementById('addProjectButton'),
    projectList: document.getElementById('projectList'),
    longtermInput: document.getElementById('longtermInput'),
    addLongtermButton: document.getElementById('addLongtermButton'),
    longtermList: document.getElementById('longtermList'),
    longtermEmpty: document.getElementById('longtermEmpty'),
    statTemporary: document.getElementById('statTemporary'),
    statProjects: document.getElementById('statProjects'),
};

const notesService = {
    async listNotes() {
        const result = await db.collection(NOTES).orderBy('created_at', 'desc').get();
        return Array.isArray(result.data) ? result.data : [];
    },

    async listProjects() {
        const result = await db.collection(PROJECTS).orderBy('created_at', 'desc').get();
        return Array.isArray(result.data) ? result.data : [];
    },

    async createNote(content, type, projectId = '') {
        const now = new Date().toISOString();
        return db.collection(NOTES).add({
            data: {
                content,
                type,
                project_id: projectId,
                completed: false,
                created_at: now,
                updated_at: now,
            },
        });
    },

    async createProject(name) {
        return db.collection(PROJECTS).add({
            data: {
                name,
                created_at: new Date().toISOString(),
            },
        });
    },

    async removeNote(id) {
        return db.collection(NOTES).doc(id).remove();
    },

    async toggleComplete(id, completed) {
        return db.collection(NOTES).doc(id).update({
            data: { completed, updated_at: new Date().toISOString() },
        });
    },
};

async function initCloudbase() {
    const cloud = window.tcb || window.cloudbase;
    if (!cloud) throw new Error('CloudBase SDK 未加载');
    app = cloud.init({ env: CLOUD_ENV });
    db = app.database();

    if (!app.auth) return;
    const auth = app.auth({ persistence: 'local' });
    if (!auth || !auth.anonymousAuthProvider) return;
    const loginState = auth.getLoginState ? await auth.getLoginState() : null;
    if (!loginState) await auth.anonymousAuthProvider().signIn();
}

function normalizeNote(note) {
    const type = note.type === 'longterm' ? 'longterm' : 'temporary';
    return {
        _id: note._id,
        content: note.content || '',
        type,
        completed: note.completed || false,
        project_id: type === 'longterm' ? (note.project_id || '') : '',
        created_at: note.created_at || note.updated_at || '',
        updated_at: note.updated_at || note.created_at || '',
    };
}

function normalizeProject(project) {
    return {
        _id: project._id,
        name: project.name || '未命名项目',
        created_at: project.created_at || '',
    };
}

function setStatus(text) {
    els.syncStatus.textContent = text;
}

function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function sortByStatusAndTime(notes) {
    return [...notes].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return String(b.updated_at).localeCompare(String(a.updated_at));
    });
}

function matchesQuery(note) {
    const keyword = state.query.trim().toLowerCase();
    return !keyword || note.content.toLowerCase().includes(keyword);
}

function getTemporaryNotes() {
    return sortByStatusAndTime(state.notes.filter((note) => note.type === 'temporary' && matchesQuery(note)));
}

function getLongtermNotes() {
    return sortByStatusAndTime(state.notes.filter((note) => (
        note.type === 'longterm' && note.project_id === state.selectedProjectId && matchesQuery(note)
    )));
}

function applyTheme() {
    document.body.classList.remove('theme-day', 'theme-night');
    document.body.classList.add(`theme-${state.theme}`);
    els.themeToggle.textContent = state.theme === 'day' ? '夜' : '日';
}

function renderCounts() {
    els.temporaryCount.textContent = state.notes.filter((note) => note.type === 'temporary').length;
    els.longtermCount.textContent = state.notes.filter((note) => note.type === 'longterm').length;
    els.projectCount.textContent = state.projects.length;

    els.statTemporary.classList.toggle('active', state.mode === 'temporary');
    els.statProjects.classList.toggle('active', state.mode === 'projects');
}

function renderMode() {
    document.querySelectorAll('.mode-button').forEach((button) => {
        button.classList.toggle('active', button.dataset.mode === state.mode);
    });
    els.temporaryPanel.classList.toggle('hidden', state.mode !== 'temporary');
    els.projectsPanel.classList.toggle('hidden', state.mode !== 'projects');
}

function createNoteCard(note) {
    const card = document.createElement('article');
    card.className = `note-card${note.completed ? ' completed' : ''}`;
    card.style.cursor = 'pointer';

    const main = document.createElement('div');
    main.className = 'note-main';

    const content = document.createElement('div');
    content.className = 'note-content';
    content.textContent = note.content;

    const time = document.createElement('div');
    time.className = 'note-time';
    time.textContent = formatTime(note.updated_at);

    const button = document.createElement('button');
    button.className = 'danger';
    button.type = 'button';
    button.textContent = '删除';
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        removeNote(note._id);
    });

    card.addEventListener('click', () => toggleComplete(note._id, note.completed));

    main.appendChild(content);
    main.appendChild(time);
    card.appendChild(main);
    card.appendChild(button);
    return card;
}

function renderProjects() {
    if (!state.selectedProjectId && state.projects.length) {
        state.selectedProjectId = state.projects[0]._id;
    }

    els.projectList.innerHTML = '';
    state.projects.forEach((project) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `project-chip${project._id === state.selectedProjectId ? ' active' : ''}`;
        button.textContent = project.name;
        button.addEventListener('click', () => {
            state.selectedProjectId = project._id;
            render();
        });
        els.projectList.appendChild(button);
    });
}

function renderNotes() {
    const temporaryNotes = getTemporaryNotes();
    const longtermNotes = getLongtermNotes();

    els.temporaryList.innerHTML = '';
    els.longtermList.innerHTML = '';
    els.temporaryEmpty.style.display = temporaryNotes.length ? 'none' : 'block';

    const noProjects = !state.projects.length;
    els.longtermEmpty.style.display = longtermNotes.length ? 'none' : 'block';
    els.longtermEmpty.textContent = noProjects ? '先创建一个长期项目。' : '当前项目暂无内容。';

    temporaryNotes.forEach((note) => els.temporaryList.appendChild(createNoteCard(note)));
    longtermNotes.forEach((note) => els.longtermList.appendChild(createNoteCard(note)));
}

function render() {
    renderCounts();
    renderMode();
    renderProjects();
    renderNotes();
}

function setMode(mode) {
    state.mode = mode;
    render();
}

async function refreshAll(silent = false) {
    if (!silent) setStatus('同步中');
    try {
        const [notes, projects] = await Promise.all([
            notesService.listNotes(),
            notesService.listProjects(),
        ]);
        state.notes = notes.map(normalizeNote);
        state.projects = projects.map(normalizeProject);
        if (!state.projects.some((project) => project._id === state.selectedProjectId)) {
            state.selectedProjectId = state.projects[0] ? state.projects[0]._id : '';
        }
        render();
        setStatus('已同步');
    } catch (error) {
        console.error('同步失败', error);
        setStatus('同步失败');
    }
}

async function addTemporary() {
    const content = els.temporaryInput.value.trim();
    if (!content) return els.temporaryInput.focus();
    try {
        await notesService.createNote(content, 'temporary');
        els.temporaryInput.value = '';
        await refreshAll(true);
    } catch (error) {
        console.error('新增临时待办失败', error);
        setStatus('新增失败');
    }
}

async function addProject() {
    const name = els.projectInput.value.trim();
    if (!name) return els.projectInput.focus();
    try {
        await notesService.createProject(name);
        els.projectInput.value = '';
        await refreshAll(true);
    } catch (error) {
        console.error('创建项目失败', error);
        setStatus('创建失败');
    }
}

async function addLongterm() {
    const content = els.longtermInput.value.trim();
    if (!content || !state.selectedProjectId) return;
    try {
        await notesService.createNote(content, 'longterm', state.selectedProjectId);
        els.longtermInput.value = '';
        await refreshAll(true);
    } catch (error) {
        console.error('新增长期待办失败', error);
        setStatus('新增失败');
    }
}

async function removeNote(id) {
    if (!confirm('确认删除这条内容？')) return;
    try {
        await notesService.removeNote(id);
        await refreshAll(true);
    } catch (error) {
        console.error('删除失败', error);
        setStatus('删除失败');
    }
}

async function toggleComplete(id, currentCompleted) {
    const completed = !currentCompleted;
    state.notes = state.notes.map((n) => n._id === id ? { ...n, completed } : n);
    render();
    try {
        await notesService.toggleComplete(id, completed);
    } catch (error) {
        console.error('更新失败', error);
        state.notes = state.notes.map((n) => n._id === id ? { ...n, completed: currentCompleted } : n);
        render();
    }
}

function bindEvents() {
    document.querySelectorAll('.mode-button').forEach((button) => {
        button.addEventListener('click', () => setMode(button.dataset.mode || 'temporary'));
    });

    [els.statTemporary, els.statProjects].forEach((card) => {
        card.addEventListener('click', () => setMode(card.dataset.mode));
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') setMode(card.dataset.mode); });
    });

    els.searchInput.addEventListener('input', (event) => {
        state.query = event.target.value;
        render();
    });
    els.addTemporaryButton.addEventListener('click', addTemporary);
    els.addProjectButton.addEventListener('click', addProject);
    els.addLongtermButton.addEventListener('click', addLongterm);
    [els.temporaryInput, els.projectInput, els.longtermInput].forEach((input, index) => {
        input.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            if (index === 0) addTemporary();
            if (index === 1) addProject();
            if (index === 2) addLongterm();
        });
    });
    els.themeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'day' ? 'night' : 'day';
        applyTheme();
    });
}

function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => refreshAll(true), POLL_INTERVAL);
}

function init() {
    applyTheme();
    bindEvents();
    setStatus('连接云端');
    initCloudbase()
        .then(() => {
            refreshAll();
            startPolling();
        })
        .catch((error) => {
            console.error('CloudBase 初始化失败', error);
            setStatus(error.message || '初始化失败');
            document.querySelectorAll('input, button').forEach((el) => {
                el.disabled = true;
            });
        });
}

init();
