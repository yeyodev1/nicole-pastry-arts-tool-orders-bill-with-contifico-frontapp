<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isMenuOpen = ref(false)
const userRole = ref<string | null>(null)
const userName = ref('')

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const logout = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user_info')
  router.push('/login')
}

onMounted(() => {
  const userInfoStr = localStorage.getItem('user_info')
  if (userInfoStr) {
    try {
      const user = JSON.parse(userInfoStr)
      userRole.value = user.role
      userName.value = user.name || user.email?.split('@')[0] || 'Usuario'
    } catch (e) {
      console.error('Error parsing user info', e)
    }
  }
})

// Role-based Nav Logic
const isRetail = computed(() => userRole.value === 'RetailManager')
const isProduction = computed(() => userRole.value === 'production')
const isSupplyChain = computed(() => userRole.value === 'SUPPLY_CHAIN_MANAGER')
const isSales = computed(() => !userRole.value || userRole.value === 'sales' || userRole.value === 'admin') // Default/Admin
</script>

<template>
  <nav class="navbar" :class="{ 'minimalist': isRetail }">
    <div class="container">
      <div class="brand">
        <router-link to="/" class="logo-link">
            <span class="logo-dot"></span>
            Nicole <span class="thin">Pastry Arts</span>
        </router-link>
      </div>
      
      <!-- Desktop Navigation -->
      <div class="nav-content desktop-only">
        <div class="nav-links">
          <!-- Retail Manager Links -->
          <template v-if="isRetail">
            <router-link to="/pos/shipments" active-class="active">
                <i class="fa-solid fa-store"></i> Gestión Sucursal
            </router-link>
          </template>

          <!-- Production Links -->
          <template v-else-if="isProduction">
            <router-link to="/production/summary" active-class="active">Producción</router-link>
            <router-link to="/production/orders" active-class="active">Órdenes</router-link>
          </template>

          <!-- Supply Chain Links -->
          <template v-else-if="isSupplyChain">
            <router-link to="/supply-chain/providers" active-class="active">Proveedores</router-link>
            <router-link to="/supply-chain/warehouse" active-class="active">Bodega</router-link>
          </template>

          <!-- Default / Sales / Admin Links -->
          <template v-else>
            <router-link to="/orders" active-class="active">Pedidos</router-link>
            <router-link to="/orders/new" active-class="active">Nuevo Pedido</router-link>
            <router-link to="/reports/sales-by-responsible" active-class="active">Ventas</router-link>
            <router-link to="/reports/delivery" active-class="active">Transporte</router-link>
          </template>
        </div>

        <div class="user-section">
          <div class="user-badge">
             <span class="user-initial">{{ userName.charAt(0).toUpperCase() }}</span>
             <span class="user-name">{{ userName }}</span>
          </div>
          <button @click="logout" class="btn-logout" title="Cerrar Sesión">
             <i class="fa-solid fa-arrow-right-from-bracket"></i>
          </button>
        </div>
      </div>

      <!-- Mobile Toggle -->
      <button class="menu-toggle" :class="{ 'is-active': isMenuOpen }" @click="toggleMenu" aria-label="Toggle menu">
        <div class="hamburger"></div>
      </button>

      <!-- Mobile Menu -->
      <Transition name="slide">
        <div v-if="isMenuOpen" class="mobile-menu">
          <div class="mobile-links">
            <template v-if="isRetail">
              <router-link to="/pos/shipments" @click="closeMenu"><i class="fa-solid fa-store"></i> Gestión Sucursal</router-link>
            </template>
            <template v-else-if="isProduction">
               <router-link to="/production/summary" @click="closeMenu">Producción</router-link>
               <router-link to="/production/orders" @click="closeMenu">Órdenes</router-link>
            </template>
            <template v-else>
              <router-link to="/orders" @click="closeMenu">Pedidos</router-link>
              <router-link to="/orders/new" @click="closeMenu">Nuevo Pedido</router-link>
              <router-link to="/reports/sales-by-responsible" @click="closeMenu">Ventas</router-link>
              <router-link to="/reports/delivery" @click="closeMenu">Transporte</router-link>
            </template>
            
            <div class="mobile-footer">
              <div class="mobile-user">
                <i class="fa-solid fa-circle-user"></i> {{ userName }}
              </div>
              <button @click="logout" class="btn-logout-mobile">Cerrar Sesión</button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </nav>
</template>

<style lang="scss" scoped>
.navbar {
  background: white;
  border-bottom: 1px solid #F1F5F9;
  padding: 0.5rem 0;
  position: sticky;
  top: 0;
  z-index: 1000;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.minimalist {
    padding: 0.4rem 0;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px);
  }

  .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }
}

.brand {
  .logo-link {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: $font-principal;
    font-size: 1.15rem;
    color: #1E293B;
    text-decoration: none;
    font-weight: 800;
    letter-spacing: -0.02em;

    .logo-dot {
      width: 10px;
      height: 10px;
      background: $NICOLE-PURPLE;
      border-radius: 50%;
    }

    .thin {
      font-weight: 300;
      color: #64748B;
    }
  }
}

.nav-content {
  display: flex;
  align-items: center;
  gap: 3rem;
  flex: 1;
  justify-content: flex-end;
}

.nav-links {
  display: flex;
  gap: 1.5rem;

  a {
    text-decoration: none;
    color: #64748B;
    font-weight: 600;
    font-size: 0.85rem;
    padding: 0.5rem 0.8rem;
    border-radius: 8px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &:hover {
      color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.05);
    }

    &.active {
      color: $NICOLE-PURPLE;
      background: rgba($NICOLE-PURPLE, 0.1);

      i {
        color: $NICOLE-PURPLE;
      }
    }

    i {
      font-size: 0.9rem;
      color: #94A3B8;
    }
  }
}

.user-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-left: 2rem;
  border-left: 1px solid #E2E8F0;
}

.user-badge {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: #F8FAFC;
  padding: 0.3rem 0.3rem 0.3rem 0.8rem;
  border-radius: 30px;
  border: 1px solid #F1F5F9;

  .user-initial {
    width: 24px;
    height: 24px;
    background: $NICOLE-PURPLE;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 800;
  }

  .user-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: #475569;
  }
}

.btn-logout {
  background: none;
  border: none;
  cursor: pointer;
  color: #94A3B8;
  font-size: 1.1rem;
  transition: all 0.2s;
  padding: 0.4rem;
  border-radius: 8px;

  &:hover {
    color: $error;
    background: rgba($error, 0.05);
    transform: translateX(2px);
  }
}

/* Mobile Menu Toggle (Premium) */
.menu-toggle {
  display: none;
  width: 40px;
  height: 40px;
  background: #F8FAFC;
  border: 1px solid #F1F5F9;
  border-radius: 10px;
  cursor: pointer;
  position: relative;
  z-index: 2000;

  .hamburger {
    width: 20px;
    height: 2px;
    background: #475569;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    transition: all 0.3s;

    &::before,
    &::after {
      content: '';
      position: absolute;
      width: 20px;
      height: 2px;
      background: #475569;
      transition: all 0.3s;
    }

    &::before {
      transform: translateY(-6px);
    }

    &::after {
      transform: translateY(6px);
    }
  }

  &.is-active .hamburger {
    background: transparent;

    &::before {
      transform: rotate(45deg);
    }

    &::after {
      transform: rotate(-45deg);
    }
  }
}

.mobile-menu {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: white;
  z-index: 1500;
  padding-top: 5rem;
}

.mobile-links {
  display: flex;
  flex-direction: column;
  padding: 0 2rem;
  gap: 1rem;

  a {
    text-decoration: none;
    color: #475569;
    font-size: 1.25rem;
    font-weight: 700;
    padding: 1rem;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 1rem;

    &:active {
      background: #F1F5F9;
    }

    i {
      color: $NICOLE-PURPLE;
      font-size: 1.2rem;
    }
  }
}

.mobile-footer {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #F1F5F9;

  .mobile-user {
    font-weight: 600;
    color: #64748B;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .btn-logout-mobile {
    width: 100%;
    padding: 1rem;
    background: #FEF2F2;
    color: #EF4444;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    font-size: 1rem;
  }
}

@media (min-width: 769px) {
  .desktop-only {
    display: flex;
  }
}

@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }

  .menu-toggle {
    display: block;
  }

  .navbar {
    padding: 0.6rem 0;
  }
}

/* Animations */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
