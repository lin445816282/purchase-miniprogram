var request = require('../../app').request

Page({
  data: {
    uname: '',
    loggedIn: false,
    stats: { total: 0, pending: 0, balance: '0.00', expense: { count: 0, pending: 0, amount: '0.00' }, income: { count: 0, pending: 0, amount: '0.00' } },
    list: [],
    showAll: true,
    selYear: null, selMonth: null,
    years: [], yearIdx: 0,
    months: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    monthIdx: 0,
    keyword: '',
    searchFields: ['全部字段','产品名称','分类','供应商','采购人','状态','备注'],
    searchFieldIdx: 0,
    page: 1, pageSize: 30, totalPages: 1, totalCount: 0,
    pageSizes: ['10条/页','30条/页','50条/页','100条/页'],
    pageSizeIdx: 1,
    showDetail: false, detail: {},
    showProfile: false,
    nickname: '', oldPwd: '', newPwd: '',
    savingProfile: false
  },

  onShow: function() {
    var app = getApp()
    this.setData({ 
      loggedIn: app.globalData.loggedIn,
      uname: app.globalData.phone || '游客'
    })
    if (app.globalData.loggedIn) {
      this.loadData()
      this.loadUser()
    }
  },

  onLoad: function() {
    var now = new Date()
    var years = []
    for (var i = 2; i >= -2; i--) years.push(now.getFullYear() + i)
    this._lastSelYear = now.getFullYear()
    this._lastSelMonth = now.getMonth() + 1
    this.setData({
      years: years,
      selYear: null,
      selMonth: null,
      yearIdx: 0,
      monthIdx: 0
    })
  },

  goLogin: function() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  loadData: function() {
    var that = this
    var params = { page: this.data.page, page_size: this.data.pageSize }
    var sp = {}
    if (!this.data.showAll) {
      if (this.data.selYear) { params.year = this.data.selYear; sp.year = this.data.selYear }
      if (this.data.selMonth) { params.month = this.data.selMonth; sp.month = this.data.selMonth }
    }
    if (this.data.keyword) {
      var fields = ['','product_name','category','supplier','purchaser','status','remark']
      params.search_field = fields[this.data.searchFieldIdx]
      params.search_keyword = this.data.keyword
      sp.search_field = params.search_field
      sp.search_keyword = this.data.keyword
    }
    Promise.all([
      request('GET', '/purchases/stats?' + toQuery(sp)),
      request('GET', '/purchases?' + toQuery(params))
    ]).then(function(results) {
      var s = results[0]
      var data = results[1]
      var inc = (s.income && s.income.amount) || 0
      var exp = (s.expense && s.expense.amount) || 0
      var balance = (inc - exp).toFixed(2)
      var stats = {}
      for (var k in s) { stats[k] = s[k] }
      stats.balance = balance
      var list = data.items.map(function(it) {
        it.statusClass = statusClass(it.status)
        return it
      })
      that.setData({
        stats: stats,
        list: list,
        totalCount: data.total,
        totalPages: data.total_pages,
        page: data.page
      })
    }).catch(function(e) {
      console.error('loadData error:', e)
    })
  },

  loadUser: function() {
    var that = this
    request('GET', '/auth/me').then(function(me) {
      that.setData({ uname: me.nickname || me.phone, nickname: me.nickname || '' })
    }).catch(function() {})
  },

  toggleAll: function() {
    var showing = !this.data.showAll
    if (showing) {
      // 切到"全部"：保存当前筛选值，清空显示
      this._lastSelYear = this.data.selYear
      this._lastSelMonth = this.data.selMonth
      this.setData({ showAll: true, page: 1, selYear: null, selMonth: null, yearIdx: 0, monthIdx: 0 })
    } else {
      // 切回筛选：恢复上次的筛选值
      var now = new Date()
      var y = this._lastSelYear || now.getFullYear()
      var m = this._lastSelMonth || (now.getMonth() + 1)
      var yi = this.data.years.indexOf(y)
      if (yi < 0) yi = 2
      this.setData({
        showAll: false, page: 1,
        selYear: y, selMonth: m,
        yearIdx: yi, monthIdx: m - 1
      })
    }
    this.loadData()
  },
  onYear: function(e) {
    var idx = Number(e.detail.value)
    var y = this.data.years[idx]
    this._lastSelYear = y
    this.setData({ selYear: y, yearIdx: idx, page: 1 })
    this.loadData()
  },
  onMonth: function(e) {
    var m = Number(e.detail.value) + 1
    this._lastSelMonth = m
    this.setData({ selMonth: m, monthIdx: Number(e.detail.value), page: 1 })
    this.loadData()
  },

  onKeyword: function(e) { this.setData({ keyword: e.detail.value }) },
  onSearchField: function(e) { this.setData({ searchFieldIdx: e.detail.value }) },
  doSearch: function() { this.setData({ page: 1 }); this.loadData() },

  prevPage: function() {
    if (this.data.page > 1) { this.setData({ page: this.data.page - 1 }); this.loadData() }
  },
  nextPage: function() {
    if (this.data.page < this.data.totalPages) { this.setData({ page: this.data.page + 1 }); this.loadData() }
  },
  onPageSize: function(e) {
    var sizes = [10,30,50,100]
    this.setData({ pageSize: sizes[e.detail.value], pageSizeIdx: e.detail.value, page: 1 })
    this.loadData()
  },

  openDetail: function(e) {
    var id = e.currentTarget.dataset.id
    var that = this
    var item = this.data.list.find(function(i) { return i.id === id })
    if (item) that.setData({ showDetail: true, detail: item })
  },
  closeDetail: function() { this.setData({ showDetail: false }) },
  goEdit: function() {
    var id = this.data.detail.id
    this.setData({ showDetail: false })
    wx.navigateTo({ url: '/pages/edit/edit?id=' + id })
  },

  delItem: function(e) {
    var that = this
    var id = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name
    wx.showModal({
      title: '删除',
      content: '确定删除「' + name + '」？',
      success: function(res) {
        if (!res.confirm) return
        request('DELETE', '/purchases/' + id).then(function() {
          wx.showToast({ title: '已删除', icon: 'none' })
          that.loadData()
        }).catch(function() {
          wx.showToast({ title: '删除失败', icon: 'none' })
        })
      }
    })
  },
  delFromDetail: function() {
    var that = this
    var id = this.data.detail.id
    wx.showModal({
      title: '删除',
      content: '确定删除「' + this.data.detail.product_name + '」？',
      success: function(res) {
        if (!res.confirm) return
        request('DELETE', '/purchases/' + id).then(function() {
          wx.showToast({ title: '已删除', icon: 'none' })
          that.setData({ showDetail: false })
          that.loadData()
        }).catch(function() {
          wx.showToast({ title: '删除失败', icon: 'none' })
        })
      }
    })
  },

  previewImg: function(e) { wx.previewImage({ urls: [e.currentTarget.dataset.url] }) },

  doExport: function() {
    if (!this.data.loggedIn) { wx.navigateTo({ url: '/pages/login/login' }); return }
    var that = this
    wx.showLoading({ title: '导出中…' })
    var params = {}
    if (!this.data.showAll) {
      if (this.data.selYear) params.year = this.data.selYear
      if (this.data.selMonth) params.month = this.data.selMonth
    }
    if (this.data.keyword) {
      var fields = ['','product_name','category','supplier','purchaser','status','remark']
      params.search_field = fields[this.data.searchFieldIdx]
      params.search_keyword = this.data.keyword
    }
    var qs = toQuery(params)
    var BASE = require('../../app').BASE
    wx.downloadFile({
      url: BASE + '/export' + (qs ? '?' + qs : ''),
      header: { Authorization: 'Bearer ' + (getApp().globalData.token || '') },
      success: function(res) {
        wx.hideLoading()
        if (res.statusCode === 200) {
          wx.openDocument({ filePath: res.tempFilePath, showMenu: true })
        } else {
          wx.showToast({ title: '导出失败', icon: 'none' })
        }
      },
      fail: function() {
        wx.hideLoading()
        wx.showToast({ title: '导出失败', icon: 'none' })
      }
    })
  },

  openProfile: function() {
    this.setData({ showProfile: true, oldPwd: '', newPwd: '' })
  },
  closeProfile: function() { this.setData({ showProfile: false }) },
  onNick: function(e) { this.setData({ nickname: e.detail.value }) },
  onOldPwd: function(e) { this.setData({ oldPwd: e.detail.value }) },
  onNewPwd: function(e) { this.setData({ newPwd: e.detail.value }) },
  saveProfile: function() {
    var that = this
    this.setData({ savingProfile: true })
    var promises = []
    if (this.data.nickname) {
      promises.push(request('PUT', '/auth/profile', { nickname: this.data.nickname }))
    }
    if (this.data.newPwd) {
      if (!this.data.oldPwd) {
        wx.showToast({ title: '请输入原密码', icon: 'none' })
        this.setData({ savingProfile: false })
        return
      }
      promises.push(request('PUT', '/auth/password', { old_password: this.data.oldPwd, new_password: this.data.newPwd }))
    }
    if (promises.length === 0) {
      this.setData({ savingProfile: false, showProfile: false })
      return
    }
    Promise.all(promises).then(function() {
      wx.showToast({ title: '已保存', icon: 'none' })
      that.setData({ showProfile: false, savingProfile: false })
      that.loadUser()
    }).catch(function() {
      wx.showToast({ title: '保存失败', icon: 'none' })
      that.setData({ savingProfile: false })
    })
  },

  doLogout: function() {
    wx.removeStorageSync('token')
    wx.removeStorageSync('phone')
    getApp().globalData.token = ''
    getApp().globalData.loggedIn = false
    this.setData({ loggedIn: false, uname: '游客', list: [], stats: { total: 0, pending: 0, balance: '0.00', expense: { count: 0, pending: 0, amount: '0.00' }, income: { count: 0, pending: 0, amount: '0.00' } } })
  },

  goAdd: function() { 
    if (!this.data.loggedIn) { wx.navigateTo({ url: '/pages/login/login' }); return }
    wx.navigateTo({ url: '/pages/edit/edit' }) 
  },
  goShares: function() {
    if (!this.data.loggedIn) { wx.navigateTo({ url: '/pages/login/login' }); return }
    wx.navigateTo({ url: '/pages/shares/shares' })
  },
  nop: function() {}
})

function statusClass(s) {
  if (!s) return ''
  if (s.indexOf('审批通过') >= 0 || s.indexOf('已完成') >= 0) return 'st-done'
  if (s.indexOf('进行中') >= 0 || s.indexOf('待审批') >= 0) return 'st-pending'
  if (s.indexOf('已取消') >= 0) return 'st-cancel'
  if (s.indexOf('审批不通过') >= 0) return 'st-reject'
  return ''
}

function toQuery(obj) {
  var parts = []
  for (var k in obj) {
    if (obj.hasOwnProperty(k)) {
      var v = obj[k]
      if (v !== null && v !== undefined && v !== '') {
        parts.push(k + '=' + v)
      }
    }
  }
  return parts.join('&')
}
