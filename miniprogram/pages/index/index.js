const db = wx.cloud.database();

Page({
  data: {
    newContent: '',
    notes: [],
  },

  onLoad() {
    this.loadNotes();
    this.setupWatch();
  },

  onUnload() {
    if (this.noteWatcher) {
      this.noteWatcher.close();
    }
  },

  onInputChange(event) {
    this.setData({ newContent: event.detail.value });
  },

  async loadNotes() {
    try {
      const result = await db.collection('notes')
        .orderBy('created_at', 'desc')
        .get();
      const notes = result.data.map((item) => ({
        ...item,
        created_at: this.formatTime(item.created_at),
        updated_at: item.updated_at,
      }));
      this.setData({ notes });
    } catch (error) {
      console.error('读取备忘录失败', error);
    }
  },

  onAddNote() {
    const content = this.data.newContent && this.data.newContent.trim();
    if (!content) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    const now = new Date();
    const payload = {
      content,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    db.collection('notes').add({ data: payload })
      .then(() => {
        this.setData({ newContent: '' });
        wx.showToast({ title: '已添加', icon: 'success' });
        this.loadNotes();
      })
      .catch((err) => {
        console.error('新增失败', err);
        wx.showToast({ title: '添加失败', icon: 'none' });
      });
  },

  onDeleteNote(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条备忘录吗？',
      success: (res) => {
        if (res.confirm) {
          db.collection('notes').doc(id).remove()
            .then(() => {
              wx.showToast({ title: '已删除', icon: 'success' });
              this.loadNotes();
            })
            .catch((err) => {
              console.error('删除失败', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            });
        }
      },
    });
  },

  setupWatch() {
    this.noteWatcher = db.collection('notes').watch({
      onChange: (snapshot) => {
        if (!snapshot || !snapshot.docs) return;
        const notes = snapshot.docs
          .map((item) => ({
            ...item,
            created_at: this.formatTime(item.created_at),
            updated_at: item.updated_at,
          }))
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        this.setData({ notes });
      },
      onError: (err) => {
        console.error('watch 监听出错', err);
      },
    });
  },

  formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },
});
