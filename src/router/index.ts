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
            if (user?.role === 'production') return { name: 'production-summary' }
            if (user?.role === 'RetailManager') return { name: 'pos-shipments' }
            if (user?.role === 'SUPPLY_CHAIN_MANAGER') return { name: 'providers-list' }
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
      path: '/orders/create',
      redirect: to => ({ name: 'create-order', query: to.query })
    },
    {
      path: '/orders/new',
      name: 'create-order',
      component: OrderCreateView,
      meta: { requiresAuth: true, title: 'Nuevo Pedido' }
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('../views/orders/OrderDetailView.vue'),
      meta: { requiresAuth: true, title: 'Detalle de Pedido' },
      beforeEnter: (to, from, next) => {
        if (to.params.id === 'create' || to.params.id === 'new') {
          next({ name: 'create-order', query: to.query });
        } else {
          next();
        }
      }
    },
    {
      path: '/reports/sales-by-responsible',
      name: 'sales-by-responsible',
      component: () => import('../views/reports/SalesByResponsibleView.vue'),
      meta: { requiresAuth: true, title: 'Reporte de Ventas' }
    },
    {
      path: '/reports/delivery',
      name: 'delivery-report',
      component: () => import('../views/reports/DeliveryReportView.vue'),
      meta: { requiresAuth: true, title: 'Reporte de Transporte' }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { title: 'Iniciar Sesión' }
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
    },
    // Supply Chain Routes
    {
      path: '/supply-chain',
      redirect: '/supply-chain/summary',
    },
    {
      path: '/supply-chain/summary',
      name: 'inventory-summary',
      component: () => import('../views/SupplyChain/InventorySummaryView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Resumen de Inventario' }
    },
    {
      path: '/supply-chain/providers',
      name: 'providers-list',
      component: () => import('../views/SupplyChain/ProvidersView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Proveedores' }
    },
    {
      path: '/supply-chain/materials',
      name: 'materials-list',
      component: () => import('../views/SupplyChain/RawMaterialsView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Materia Prima' }
    },
    {
      path: '/supply-chain/warehouse',
      name: 'warehouse',
      component: () => import('../views/SupplyChain/WarehouseView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Bodega' }
    },
    {
      path: '/supply-chain/orders',
      name: 'supplier-orders-history',
      component: () => import('../views/SupplyChain/SupplierOrderHistoryView.vue'),
      meta: { requiresAuth: true, role: 'SUPPLY_CHAIN_MANAGER', title: 'Historial de Pedidos' }
    },
    // POS / RetailManager Routes
    {
      path: '/pos/shipments',
      name: 'pos-shipments',
      component: () => import('../views/pos/IncomingShipmentsView.vue'),
      meta: { requiresAuth: true, role: 'RetailManager', title: 'Recepción de Pedidos' }
    },
    {
      path: '/pos/restock-form',
      name: 'pos-restock-form',
      component: () => import('../views/pos/RestockDailyForm.vue'),
      meta: { requiresAuth: true, role: 'RetailManager', title: 'Cierre de Producción' }
    },
    {
      path: '/pos/restock-management',
      name: 'pos-restock-management',
      component: () => import('../views/pos/RestockManagementView.vue'),
      meta: { requiresAuth: true, role: 'RetailManager', title: 'Configuración Stock' }
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
    if (role === 'production') next({ name: 'production-summary' })
    else if (role === 'RetailManager') next({ name: 'pos-shipments' })
    else if (role === 'SUPPLY_CHAIN_MANAGER') next({ name: 'providers-list' })
    else next({ name: 'create-order' })
    return
  }

  // 3. Role-Based Access Control logic
  if (isAuthenticated) {
    // Production user
    if (role === 'production' && !to.path.startsWith('/production')) {
      next({ name: 'production-summary' })
      return
    }

    // RetailManager user should stick to /pos
    if (role === 'RetailManager' && !to.path.startsWith('/pos')) {
      next({ name: 'pos-shipments' })
      return
    }

    // Supply Chain user
    if (role === 'SUPPLY_CHAIN_MANAGER' && !to.path.startsWith('/supply-chain')) {
      next({ name: 'providers-list' })
      return
    }

    // Sales user trying to access production or pos routes?
    if (role === 'sales' && (to.path.startsWith('/production') || to.path.startsWith('/pos'))) {
      next({ name: 'create-order' })
      return
    }
  }

  next()
})

export default router
