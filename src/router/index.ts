import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import OrderCreateView from '../views/orders/OrderCreateView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/orders/new'
    },
    {
      path: '/orders',
      name: 'list-orders',
      component: () => import('../views/orders/OrderListView.vue'), // Lazy load
      meta: { requiresAuth: true }
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('../views/orders/OrderDetailView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/reports/sales-by-responsible',
      name: 'sales-by-responsible',
      component: () => import('../views/reports/SalesByResponsibleView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/orders/new',
      name: 'create-order',
      component: OrderCreateView,
      meta: { requiresAuth: true }
    },
    {
      path: '/production',
      name: 'production-dashboard',
      component: () => import('../views/production/ProductionDashboardView.vue'),
      meta: { requiresAuth: true, role: 'production' }
    },
    {
      path: '/production/summary',
      name: 'production-summary',
      component: () => import('../views/production/ProductionItemsSummaryView.vue'),
      meta: { requiresAuth: true, role: 'production' }
    }
  ],
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('access_token')
  const userInfoStr = localStorage.getItem('user_info')
  const user = userInfoStr ? JSON.parse(userInfoStr) : null
  const role = user?.role

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
    return
  }

  if (to.name === 'login' && isAuthenticated) {
    if (role === 'production') next({ name: 'production-dashboard' })
    else next({ name: 'create-order' })
    return
  }

  // Role based access control
  if (isAuthenticated) {
    if (role === 'production' && !to.path.startsWith('/production')) {
      next({ name: 'production-dashboard' })
      return
    }

    if (role === 'sales' && to.path.startsWith('/production')) {
      next({ name: 'create-order' })
      return
    }
  }

  next()
})

export default router
