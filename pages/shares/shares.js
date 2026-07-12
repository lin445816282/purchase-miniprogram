var request = require('../../app').request
var permLabel = { read: '仅查看', write: '可增加', admin: '管理' }

Page({
  data: {
    newPhone: '',
    newPerm: 'read',
    adding: false,
    searchQ: '',
    searchResults: [],
    outgoing: [],
    incoming: [],
    perms: ['仅查看', '可增加', '管理']
  },

  onShow: function() {
    this.loadList()
  },

  loadList: function() {
    var that = this
    request('GET', '/shares').then(function(d) {
      var out = (d.outgoing || []).map(function(s) {
        s.permLabel = permLabel[s.permission] || s.permission
        s.permIdx = s.permission === 'read' ? 0 : s.permission === 'write' ? 1 : 2
        return s
      })
      var inc = (d.incoming || []).map(function(s) {
        s.permLabel = permLabel[s.permission] || s.permission
        return s
      })
      that.setData({ outgoing: out, incoming: inc })
    }).catch(function(e) {
      console.error('loadList:', e)
    })
  },

  onNewPhone: function(e) { this.setData({ newPhone: e.detail.value }) },
  setPerm: function(e) { this.setData({ newPerm: e.currentTarget.dataset.perm }) },

  doAdd: function() {
    var that = this
    if (!this.data.newPhone) { wx.showToast({ title: '请输入手机号', icon: 'none' }); return }
    this.setData({ adding: true })
    request('POST', '/shares', { phone: this.data.newPhone, permission: this.data.newPerm }).then(function() {
      wx.showToast({ title: '添加成功', icon: 'none' })
      that.setData({ newPhone: '', adding: false })
      that.loadList()
    }).catch(function(e) {
      wx.showToast({ title: (e && e.data && e.data.detail) || '添加失败', icon: 'none' })
      that.setData({ adding: false })
    })
  },

  onPermChange: function(e) {
    var id = e.currentTarget.dataset.id
    var perm = ['read', 'write', 'admin'][e.detail.value]
    var that = this
    request('PUT', '/shares/' + id, { permission: perm }).then(function() {
      wx.showToast({ title: '已更新', icon: 'none' })
      that.loadList()
    }).catch(function(e) {
      wx.showToast({ title: (e && e.data && e.data.detail) || '更新失败', icon: 'none' })
    })
  },

  doDelete: function(e) {
    var id = e.currentTarget.dataset.id
    var phone = e.currentTarget.dataset.phone
    var that = this
    wx.showModal({
      title: '解除关联',
      content: '确定解除与 ' + phone + ' 的关联？',
      success: function(res) {
        if (!res.confirm) return
        request('DELETE', '/shares/' + id).then(function() {
          wx.showToast({ title: '已解除', icon: 'none' })
          that.loadList()
        }).catch(function(e) {
          wx.showToast({ title: (e && e.data && e.data.detail) || '操作失败', icon: 'none' })
        })
      }
    })
  },

  onSearchQ: function(e) {
    this.setData({ searchQ: e.detail.value })
  },

  doSearch: function() {
    var q = this.data.searchQ
    if (!q || q.length < 3) { wx.showToast({ title: '至少输入3个字', icon: 'none' }); return }
    var that = this
    request('GET', '/shares/search-user?q=' + q).then(function(r) {
      that.setData({ searchResults: r || [] })
    }).catch(function() {
      that.setData({ searchResults: [] })
    })
  },

  pickUser: function(e) {
    this.setData({ newPhone: e.currentTarget.dataset.phone, searchResults: [] })
  }
})
