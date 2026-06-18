// 认证状态
import { defineStore } from 'pinia'

export const useAuth = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('nc_token') || null,
    user: JSON.parse(localStorage.getItem('nc_user') || 'null')
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isAdmin: (s) => !!s.user?.isAdmin
  },
  actions: {
    setSession(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem('nc_token', token)
      localStorage.setItem('nc_user', JSON.stringify(user))
    },
    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem('nc_token')
      localStorage.removeItem('nc_user')
    }
  }
})
