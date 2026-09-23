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
    uploadMsg: '',
    imageList: [],
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
      var images = []
      try { images = JSON.parse(data.receipt_images || '[]') } catch(e) {}
      var IMG_BASE = 'https://www.ct256.cn'
      var absImgs = images.map(function(u) { return u.startsWith('http') ? u : IMG_BASE + u })
      that.setData({ form: data, imageList: absImgs })
      that.calcTotal()
    }).catch(function() {
      wx.showToast({ title: '加载失败', icon: 'none' })
      wx.navigateBack()
    })
  },

  onField: function(e) {
    var key = e.currentTarget.dataset.key
    var val = e.detail.value
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
    this.setData({ totalAmount: (q * p).toFixed(3) })
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
    var existingAbs = this.data.imageList
    var IMG_BASE = 'https://www.ct256.cn'
    var existingRel = existingAbs.map(function(u) {
      return u.startsWith(IMG_BASE) ? u.slice(IMG_BASE.length) : u
    })
    var remain = 9 - existingAbs.length
    if (remain <= 0) {
      wx.showToast({ title: '最多9张图片', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      success: function(res) {
        var files = res.tempFiles
        if (!files || !files.length) return
        that.setData({ uploading: true, uploadProgress: 0, uploadMsg: '准备上传...' })
        var total = files.length
        var done = 0
        var urls = []
        var fs = wx.getFileSystemManager()
        var uploadOne = function(i) {
          if (i >= total) {
            var relUrls = urls.map(function(u) {
              return u.replace('https://www.ct256.cn', '')
            })
            var allRel = existingRel.concat(relUrls)
            var allAbs = existingAbs.concat(urls)
            that.setData({ imageList: allAbs, 'form.receipt_images': JSON.stringify(allRel), uploadProgress: 100, uploadMsg: '上传完成' })
            setTimeout(function() { that.setData({ uploading: false }) }, 500)
            return
          }
          var file = files[i]
          that.setData({ uploadMsg: '上传中 ' + (i + 1) + '/' + total })
          fs.readFile({
            filePath: file.tempFilePath,
            encoding: 'base64',
            success: function(readRes) {
              var base64 = 'data:' + (file.fileType || 'image/jpeg') + ';base64,' + readRes.data
              wx.request({
                url: BASE + '/upload-base64',
                method: 'POST',
                header: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (getApp().globalData.token || '') },
                data: { images: [base64] },
                success: function(reqRes) {
                  if (reqRes.statusCode === 200 && reqRes.data.urls && reqRes.data.urls.length) {
                    var absUrls = reqRes.data.urls.map(function(u) { return u.startsWith('http') ? u : IMG_BASE + u })
                    urls = urls.concat(absUrls)
                  }
                },
                fail: function(err) { console.error('upload fail', err) },
                complete: function() {
                  done++
                  that.setData({ uploadProgress: Math.min(99, Math.round(done / total * 100)) })
                  uploadOne(i + 1)
                }
              })
            },
            fail: function(err) {
              console.error('readFile fail', err)
              done++
              uploadOne(i + 1)
            }
          })
        }
        uploadOne(0)
      }
    })
  },

  removeImg: function(e) {
    var idx = e.currentTarget.dataset.idx
    var absImgs = this.data.imageList.slice()
    var IMG_BASE = 'https://www.ct256.cn'
    absImgs.splice(idx, 1)
    var relImgs = absImgs.map(function(u) {
      return u.startsWith(IMG_BASE) ? u.slice(IMG_BASE.length) : u
    })
    this.setData({ imageList: absImgs, 'form.receipt_images': JSON.stringify(relImgs) })
  },
  previewImgs: function(e) {
    var idx = e.currentTarget.dataset.idx
    var imgs = this.data.imageList
    wx.previewImage({ urls: imgs, current: imgs[idx] })
  },

  doSave: function() {
    var that = this
    var f = this.data.form
    if (!f.product_name || !f.order_date) {
      return wx.showToast({ title: '请填写产品和日期', icon: 'none' })
    }
    this.setData({ saving: true })
    var payload = {}
    for (var k in f) { payload[k] = f[k] }
    var qty = parseFloat(payload.quantity)
    var upr = parseFloat(payload.unit_price)
    payload.quantity = isNaN(qty) ? 0 : qty
    payload.unit_price = isNaN(upr) ? 0 : upr

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
