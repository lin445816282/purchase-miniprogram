var app = require('../../app')
var request = app.request
var BASE = app.BASE

Page({
  data: {
    isEdit: false,
    editId: null,
    form: {
      product_name: '', category: '支出', supplier: '', quantity: 1, unit_price: 0,
      purchaser: '', status: '审批通过', order_date: '', remark: '', receipt_image: ''
    },
    totalAmount: '0.00',
    categories: ['支出', '支出 > 广告', '收入', '收入 > 提现'],
    statuses: ['审批通过', '待审批', '进行中', '已完成', '已取消', '审批不通过'],
    showCat: false,
    showStatus: false,
    showSuggest: false,
    suggestions: [],
    suggestTimer: null,
    uploading: false,
    uploadProgress: 0,
    saving: false
  },

  onLoad: function(options) {
    if (options.id) {
      this.setData({ isEdit: true, editId: options.id })
      wx.setNavigationBarTitle({ title: '编辑采购' })
      this.loadPurchase(options.id)
    } else {
      var now = new Date().toISOString().slice(0, 10)
      var phone = getApp().globalData.phone || ''
      this.setData({ 'form.order_date': now, 'form.purchaser': phone })
    }
  },

  loadPurchase: function(id) {
    var that = this
    request('GET', '/purchases/' + id).then(function(data) {
      that.setData({ form: data })
      that.calcTotal()
    }).catch(function() {
      wx.showToast({ title: '加载失败', icon: 'none' })
      wx.navigateBack()
    })
  },

  onField: function(e) {
    var key = e.currentTarget.dataset.key
    var val = e.detail.value
    if (key === 'quantity' || key === 'unit_price') val = parseFloat(val) || 0
    var obj = {}
    obj['form.' + key] = val
    this.setData(obj)
    this.calcTotal()
    if (key === 'product_name') this.fetchSuggestions(val)
  },

  fetchSuggestions: function(q) {
    var that = this
    clearTimeout(this.data.suggestTimer)
    if (!q) { this.setData({ showSuggest: false, suggestions: [] }); return }
    this.data.suggestTimer = setTimeout(function() {
      request('GET', '/products?q=' + encodeURIComponent(q)).then(function(names) {
        var items = names.map(function(n, i, arr) {
          return { name: n, _last: i === arr.length - 1 }
        })
        that.setData({ showSuggest: true, suggestions: items })
      }).catch(function() {})
    }, 250)
  },

  selectProduct: function(e) {
    this.setData({ 'form.product_name': e.currentTarget.dataset.name, showSuggest: false })
  },

  calcTotal: function() {
    var q = parseFloat(this.data.form.quantity) || 0
    var p = parseFloat(this.data.form.unit_price) || 0
    this.setData({ totalAmount: (q * p).toFixed(2) })
  },

  onDate: function(e) { this.setData({ 'form.order_date': e.detail.value }) },

  showCatPicker: function() { this.setData({ showCat: true, showSuggest: false }) },
  hideCat: function() { this.setData({ showCat: false }) },
  pickCat: function(e) { this.setData({ 'form.category': e.currentTarget.dataset.val, showCat: false }) },
  showStatusPicker: function() { this.setData({ showStatus: true, showSuggest: false }) },
  hideStatus: function() { this.setData({ showStatus: false }) },
  pickStatus: function(e) { this.setData({ 'form.status': e.currentTarget.dataset.val, showStatus: false }) },

  chooseImg: function() {
    var that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: function(res) {
        var file = res.tempFiles[0]
        that.setData({ uploading: true, uploadProgress: 0 })
        var task = wx.uploadFile({
          url: BASE + '/upload',
          filePath: file.tempFilePath,
          name: 'file',
          header: { Authorization: 'Bearer ' + (getApp().globalData.token || '') },
          success: function(res) {
            try {
              var data = JSON.parse(res.data)
              that.setData({ 'form.receipt_image': data.url, uploadProgress: 100 })
            } catch (e) {
              wx.showToast({ title: '上传失败', icon: 'none' })
            }
          },
          fail: function() { wx.showToast({ title: '上传失败', icon: 'none' }) },
          complete: function() { setTimeout(function() { that.setData({ uploading: false }) }, 500) }
        })
        task.onProgressUpdate(function(res) {
          that.setData({ uploadProgress: Math.min(99, res.progress) })
        })
      }
    })
  },

  removeImg: function() { this.setData({ 'form.receipt_image': '' }) },
  previewImg: function() { wx.previewImage({ urls: [this.data.form.receipt_image] }) },

  doSave: function() {
    var that = this
    var f = this.data.form
    if (!f.product_name || !f.order_date) {
      return wx.showToast({ title: '请填写产品和日期', icon: 'none' })
    }
    this.setData({ saving: true })
    var payload = {}
    for (var k in f) { payload[k] = f[k] }
    if (!payload.quantity || isNaN(payload.quantity)) payload.quantity = 0
    if (!payload.unit_price || isNaN(payload.unit_price)) payload.unit_price = 0

    var promise
    if (this.data.isEdit) {
      promise = request('PUT', '/purchases/' + this.data.editId, payload)
    } else {
      promise = request('POST', '/purchases', payload)
    }
    promise.then(function() {
      wx.showToast({ title: that.data.isEdit ? '已更新' : '已创建', icon: 'none' })
      setTimeout(function() { wx.navigateBack() }, 500)
    }).catch(function() {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }).then(function() {
      that.setData({ saving: false })
    })
  },

  nop: function() {}
})
