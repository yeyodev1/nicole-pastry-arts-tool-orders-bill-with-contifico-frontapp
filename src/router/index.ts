import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import OrderCreateView from '../views/orders/OrderCreateView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: (to) => {
        // Redirect based on stored role or default to login
        const userInfoStr = localStorage.getItem('user_info')
        if (userInfoStr) {
          try {
            const user = JSON.parse(userInfoStr)
            if (user?.role === 'production') return { name: 'production-summary' }
            return { name: 'create-order' }
          } catch (e) {
            return { name: 'login' }
          }
        }
        return { name: 'login' }
      }
    },
    {
      path: '/orders',
      name: 'list-orders',
      component: () => import('../views/orders/OrderListView.vue'), // Lazy load
      meta: { requiresAuth: true, title: 'Lista de Pedidos' }
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('../views/orders/OrderDetailView.vue'),
      meta: { requiresAuth: true, title: 'Detalle de Pedido' }
    },
    {
      path: '/reports/sales-by-responsible',
      name: 'sales-by-responsible',
      component: () => import('../views/reports/SalesByResponsibleView.vue'),
      meta: { requiresAuth: true, title: 'Reporte de Ventas' }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { title: 'Iniciar Sesión' }
    },
    {
      path: '/orders/new',
      name: 'create-order',
      component: OrderCreateView,
      meta: { requiresAuth: true, title: 'Nuevo Pedido' }
    },
    {
      path: '/production',
      redirect: '/production/summary'
    },
    {
      path: '/production/summary',
      name: 'production-summary',
      component: () => import('../views/production/ProductionItemsSummaryView.vue'),
      meta: { requiresAuth: true, role: 'production', title: 'Resumen de Producción' }
    },
    {
      path: '/production/orders',
      name: 'production-orders',
      component: () => import('../views/production/ProductionOrdersView.vue'),
      meta: { requiresAuth: true, role: 'production', title: 'Órdenes de Producción' }
    },
    {
      path: '/production/reports',
      name: 'production-reports',
      component: () => import('../views/production/ProductionReportsView.vue'),
      meta: { requiresAuth: true, role: 'production', title: 'Reportes de Producción' }
    }
  ],
})

router.beforeEach((to, from, next) => {
  // Update Document Title
  const appTitle = 'Nicole Pastry Arts'
  document.title = to.meta.title ? `${to.meta.title} | ${appTitle}` : appTitle

  const isAuthenticated = localStorage.getItem('access_token')
  const userInfoStr = localStorage.getItem('user_info')
  let user: any = null

  if (userInfoStr) {
    try {
      user = JSON.parse(userInfoStr)
    } catch (e) {
      console.error('Error parsing user info', e)
    }
  }

  const role = user?.role

  // 1. Check Authentication for protected routes
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
    return
  }

  // 2. Redirect authenticated users away from login page
  if (to.name === 'login' && isAuthenticated) {
    if (role === 'production') next({ name: 'production-summary' })
    else next({ name: 'create-order' })
    return
  }

  // 3. Role-Based Access Control logic
  if (isAuthenticated) {
    // Production user trying to access non-production and non-public routes?
    // (Assuming they shouldn't access sales routes)
    if (role === 'production' && !to.path.startsWith('/production')) {
      // Allow them to go to their home
      next({ name: 'production-summary' })
      return
    }

    // Sales user trying to access production routes?
    if (role === 'sales' && to.path.startsWith('/production')) {
      next({ name: 'create-order' })
      return
    }
  }

  next()
})

export default router
