const CLOUD_ENV = 'cloud1-d8gzx0xvwbed1f1f4';
const NOTES = 'notes';
const PROJECTS = 'projects';
const db = wx.cloud.database({ env: CLOUD_ENV });

const notesService = {
  listNotes() {
    return db.collection(NOTES).orderBy('created_at', 'desc').get();
  },

  listProjects() {
    return db.collection(PROJECTS).orderBy('created_at', 'desc').get();
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
    project_id: type === 'longterm' ? (note.project_id || '') : '',
    created_at: note.created_at || note.updated_at || '',
    updated_at: note.updated_at || note.created_at || '',
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

function sortByUpdated(notes) {
  return [...notes].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

function buildViewModel(notes, projects, query, selectedProjectId) {
  const keyword = query.trim().toLowerCase();
  const normalizedNotes = notes.map(normalizeNote);
  const normalizedProjects = projects.map(normalizeProject);
  const selectedId = selectedProjectId || (normalizedProjects[0] && normalizedProjects[0]._id) || '';
  const match = (note) => !keyword || note.content.toLowerCase().includes(keyword);
  const temporaryNotes = sortByUpdated(normalizedNotes.filter((note) => note.type === 'temporary' && match(note)));
  const longtermNotes = sortByUpdated(normalizedNotes.filter((note) => (
    note.type === 'longterm' && note.project_id === selectedId && match(note)
  )));

  return {
    notes: normalizedNotes,
    projects: normalizedProjects,
    selectedProjectId: selectedId,
    temporaryNotes,
    longtermNotes,
    temporaryCount: normalizedNotes.filter((note) => note.type === 'temporary').length,
    longtermCount: normalizedNotes.filter((note) => note.type === 'longterm').length,
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

  onTemporaryInput(event) {
    this.setData({ temporaryInput: event.detail.value });
  },

  onProjectInput(event) {
    this.setData({ projectInput: event.detail.value });
  },

  onLongtermInput(event) {
    this.setData({ longtermInput: event.detail.value });
  },

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
      if (!this.notesWatcher) this.loadAll();
    } catch (error) {
      console.error('新增临时待办失败', error);
      wx.showToast({ title: '新增失败', icon: 'none' });
    }
  },

  async addProject() {
    const name = this.data.projectInput.trim();
    if (!name) return;
    try {
      await notesService.createProject(name);
      this.setData({ projectInput: '' });
      if (!this.projectsWatcher) this.loadAll();
    } catch (error) {
      console.error('创建项目失败', error);
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  async addLongterm() {
    const content = this.data.longtermInput.trim();
    if (!content || !this.data.selectedProjectId) return;
    try {
      await notesService.createLongterm(content, this.data.selectedProjectId);
      this.setData({ longtermInput: '' });
      if (!this.notesWatcher) this.loadAll();
    } catch (error) {
      console.error('新增长期待办失败', error);
      wx.showToast({ title: '新增失败', icon: 'none' });
    }
  },

  deleteNote(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '删除待办',
      content: '确认删除这条内容吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await notesService.removeNote(id);
          if (!this.notesWatcher) this.loadAll();
        } catch (error) {
          console.error('删除失败', error);
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },

  setupWatchers() {
    if (this.notesWatcher) this.notesWatcher.close();
    if (this.projectsWatcher) this.projectsWatcher.close();

    this.notesWatcher = db.collection(NOTES).watch({
      onChange: (snapshot) => {
        if (!snapshot || !snapshot.docs) return;
        this.applyData(snapshot.docs, this.data.projects, 'notes 实时同步');
      },
      onError: (error) => this.retryWatch(error),
    });

    this.projectsWatcher = db.collection(PROJECTS).watch({
      onChange: (snapshot) => {
        if (!snapshot || !snapshot.docs) return;
        this.applyData(this.data.notes, snapshot.docs, 'projects 实时同步');
      },
      onError: (error) => this.retryWatch(error),
    });
  },

  retryWatch(error) {
    console.warn('watch 监听出错', error);
    if (this.notesWatcher) {
      this.notesWatcher.close();
      this.notesWatcher = null;
    }
    if (this.projectsWatcher) {
      this.projectsWatcher.close();
      this.projectsWatcher = null;
    }
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.loadAll();
      this.setupWatchers();
    }, 3000);
  },
});
