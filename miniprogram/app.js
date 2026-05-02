App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库，开启云能力。');
    } else {
      wx.cloud.init({
        env: 'auto',
        traceUser: true,
      });
    }
  },
});
