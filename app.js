var BASE = 'https://www.ct256.cn/purchase/api'

App({
  globalData: { token: '', phone: '', loggedIn: false },
  onLaunch: function() {
    var token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
      this.globalData.phone = wx.getStorageSync('phone') || ''
      this.globalData.loggedIn = true
    }
  }
})

function request(method, path, data) {
  return new Promise(function(resolve, reject) {
    var app = getApp()
    wx.request({
      url: BASE + path,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (app.globalData.token || '')
      },
      success: function(res) {
        if (res.statusCode === 401) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('phone')
          app.globalData.token = ''
          app.globalData.loggedIn = false
          reject(new Error('未登录'))
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(res)
        }
      },
      fail: function(err) {
        reject(err)
      }
    })
  })
}

module.exports = { BASE: BASE, request: request }
