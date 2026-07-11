var app = getApp()

Page({
  data: { phone: '', password: '', loading: false, agreed: false },

  onLoad: function() {
    // 如果已登录，直接返回
    if (app.globalData.loggedIn) {
      wx.navigateBack({ delta: 1 })
    }
  },

  onPhone: function(e) { this.setData({ phone: e.detail.value }) },
  onPwd: function(e) { this.setData({ password: e.detail.value }) },

  toggleAgree: function() {
    this.setData({ agreed: !this.data.agreed })
  },

  openAgreement: function() {
    wx.navigateTo({ url: '/pages/agreement/agreement' })
  },

  openPrivacy: function() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  doLogin: function() {
    var that = this
    if (!this.data.phone || !this.data.password) {
      wx.showToast({ title: '请输入手机号和密码', icon: 'none' })
      return
    }
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    var request = require('../../app').request
    request('POST', '/auth/login', { phone: this.data.phone, password: this.data.password })
      .then(function(data) {
        app.globalData.token = data.token
        app.globalData.phone = that.data.phone
        app.globalData.loggedIn = true
        wx.setStorageSync('token', data.token)
        wx.setStorageSync('phone', that.data.phone)
        wx.navigateBack({ delta: 1 })
      })
      .catch(function(err) {
        wx.showToast({ title: '登录失败', icon: 'none' })
        that.setData({ loading: false })
      })
  }
})
