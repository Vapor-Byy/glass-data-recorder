const CLOUD_ENV = 'cloud1-d8gzx0xvwbed1f1f4';
const NOTES = 'notes';
const PROJECTS = 'projects';
const db = wx.cloud.database({ env: CLOUD_ENV });
// 小程序端用 {openid} 占位符，云开发会自动替换为当前用户的 openid
const OWNER_FILTER = { _openid: db.command.eq('{openid}') };

const notesService = {
  listNotes() {
    return db.collection(NOTES).where(OWNER_FILTER).orderBy('created_at', 'desc').get();
  },

  listProjects() {
    return db.collection(PROJECTS).where(OWNER_FILTER).orderBy('created_at', 'desc').get();
  },

  createTemporary(content) {
    return this.createNote(content, 'temporary', '');
  },

  createLongterm(content, projectId) {
    return this.createNote(content, 'longterm', projectId);
  },

  createNote(content, type, projectId) {
    const now = new Date().toISOString();
    return db.collection(NOTES).add({
      data: {
        content,
        type,
        project_id: projectId || '',
        completed: false, // 新增字段
        created_at: now,
        updated_at: now,
      },
    });
  },

  createProject(name) {
    return db.collection(PROJECTS).add({
      data: {
        name,
        created_at: new Date().toISOString(),
      },
    });
  },

  removeNote(id) {
    return db.collection(NOTES).doc(id).remove();
  },

  removeProject(id) {
    return db.collection(PROJECTS).doc(id).remove();
  },

  toggleComplete(id, completed) {
    return db.collection(NOTES).doc(id).update({
      data: { completed }
    });
  }
};

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function normalizeNote(note) {
  const type = note.type === 'longterm' ? 'longterm' : 'temporary';
  return {
    _id: note._id,
    content: note.content || '',
    type,
    completed: note.completed || false, // 关键
    project_id: type === 'longterm' ? (note.project_id || '') : '',
    created_at: note.created_at || '',
    updated_at: note.updated_at || '',
    displayTime: formatTime(note.updated_at || note.created_at),
  };
}

function normalizeProject(project) {
  return {
    _id: project._id,
    name: project.name || '未命名项目',
    created_at: project.created_at || '',
  };
}

// ⭐核心排序：未完成在前
function sortByStatusAndTime(notes) {
  return [...notes].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return String(b.updated_at).localeCompare(String(a.updated_at));
  });
}

function buildViewModel(notes, projects, query, selectedProjectId) {
  const keyword = query.trim().toLowerCase();
  const normalizedNotes = notes.map(normalizeNote);
  const normalizedProjects = projects.map(normalizeProject);
  const selectedId = selectedProjectId || (normalizedProjects[0] && normalizedProjects[0]._id) || '';

  const match = (note) => !keyword || note.content.toLowerCase().includes(keyword);

  let temporaryCount = 0;
  let longtermCount = 0;
  const temporaryFiltered = [];
  const longtermFiltered = [];

  for (const note of normalizedNotes) {
    if (note.type === 'temporary') {
      temporaryCount++;
      if (match(note)) temporaryFiltered.push(note);
    } else {
      longtermCount++;
      if (note.project_id === selectedId && match(note)) longtermFiltered.push(note);
    }
  }

  return {
    notes: normalizedNotes,
    projects: normalizedProjects,
    selectedProjectId: selectedId,
    temporaryNotes: sortByStatusAndTime(temporaryFiltered),
    longtermNotes: sortByStatusAndTime(longtermFiltered),
    temporaryCount,
    longtermCount,
    projectCount: normalizedProjects.length,
  };
}

Page({
  data: {
    mode: 'temporary',
    syncStatus: '初始化中',
    searchText: '',
    temporaryInput: '',
    projectInput: '',
    longtermInput: '',
    selectedProjectId: '',
    notes: [],
    projects: [],
    temporaryNotes: [],
    longtermNotes: [],
    temporaryCount: 0,
    longtermCount: 0,
    projectCount: 0,
  },

  notesWatcher: null,
  projectsWatcher: null,
  retryTimer: null,

  onLoad() {
    this.loadAll();
    this.setupWatchers();
  },

  onUnload() {
    if (this.notesWatcher) this.notesWatcher.close();
    if (this.projectsWatcher) this.projectsWatcher.close();
    if (this.retryTimer) clearTimeout(this.retryTimer);
  },

  applyData(notes, projects, status = '已同步') {
    this.setData({
      ...buildViewModel(notes, projects, this.data.searchText, this.data.selectedProjectId),
      syncStatus: status,
    });
  },

  async loadAll() {
    this.setData({ syncStatus: '同步中' });
    try {
      const [notesResult, projectsResult] = await Promise.all([
        notesService.listNotes(),
        notesService.listProjects(),
      ]);
      this.applyData(notesResult.data || [], projectsResult.data || [], '已同步');
    } catch (error) {
      console.error('同步失败', error);
      this.setData({ syncStatus: '同步失败' });
    }
  },

  // ⭐点击卡片切换完成状态
  toggleComplete(event) {
    const id = event.currentTarget.dataset.id;
    const notes = this.data.notes;
    const idx = notes.findIndex(n => n._id === id);
    if (idx === -1) return;

    const completed = !notes[idx].completed;
    const updated = notes.map((n, i) => i === idx ? { ...n, completed } : n);
    this.applyData(updated, this.data.projects, this.data.syncStatus);

    notesService.toggleComplete(id, completed)
      .catch(() => {
        this.applyData(notes, this.data.projects, this.data.syncStatus);
        wx.showToast({ title: '更新失败', icon: 'none' });
      });
  },

  setMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode || 'temporary' });
  },

  onSearchChange(event) {
    const searchText = event.detail.value;
    this.setData({
      searchText,
      ...buildViewModel(this.data.notes, this.data.projects, searchText, this.data.selectedProjectId),
    });
  },

  onTemporaryInput(e) { this.setData({ temporaryInput: e.detail.value }); },
  onProjectInput(e) { this.setData({ projectInput: e.detail.value }); },
  onLongtermInput(e) { this.setData({ longtermInput: e.detail.value }); },

  selectProject(event) {
    const selectedProjectId = event.currentTarget.dataset.id || '';
    this.setData({
      ...buildViewModel(this.data.notes, this.data.projects, this.data.searchText, selectedProjectId),
    });
  },

  async addTemporary() {
    const content = this.data.temporaryInput.trim();
    if (!content) return;
    try {
      await notesService.createTemporary(content);
      this.setData({ temporaryInput: '' });
    } catch {
      wx.showToast({ title: '新增失败', icon: 'none' });
    }
  },

  async addProject() {
    const name = this.data.projectInput.trim();
    if (!name) return;
    try {
      await notesService.createProject(name);
      this.setData({ projectInput: '' });
    } catch {
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  async addLongterm() {
    const content = this.data.longtermInput.trim();
    if (!content || !this.data.selectedProjectId) return;
    try {
      await notesService.createLongterm(content, this.data.selectedProjectId);
      this.setData({ longtermInput: '' });
    } catch {
      wx.showToast({ title: '新增失败', icon: 'none' });
    }
  },

  deleteNote(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '删除待办',
      content: '确认删除？',
      success: async (res) => {
        if (!res.confirm) return;
        await notesService.removeNote(id);
      },
    });
  },

  deleteProject(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '删除项目',
      content: '删除项目后，该项目下的所有备忘录也会一并删除，确认删除？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          // 先删除该项目下所有备忘录
          const { data: notes } = await db.collection(NOTES)
            .where({ _openid: db.command.eq('{openid}'), project_id: id })
            .get();
          await Promise.all(notes.map(n => notesService.removeNote(n._id)));
          await notesService.removeProject(id);
        } catch {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },

  setupWatchers() {
    const retry = () => {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        if (this.notesWatcher) { try { this.notesWatcher.close(); } catch (_) {} }
        if (this.projectsWatcher) { try { this.projectsWatcher.close(); } catch (_) {} }
        this.setupWatchers();
      }, 3000);
    };

    this.notesWatcher = db.collection(NOTES).where(OWNER_FILTER).watch({
      onChange: (snapshot) => {
        this.applyData(snapshot.docs, this.data.projects, '实时同步');
      },
      onError: retry,
    });

    this.projectsWatcher = db.collection(PROJECTS).where(OWNER_FILTER).watch({
      onChange: (snapshot) => {
        this.applyData(this.data.notes, snapshot.docs, '实时同步');
      },
      onError: retry,
    });
  }
});