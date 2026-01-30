<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const handleLogout = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user_info')
  router.push('/login')
}
</script>

<template>
  <header class="navbar">
    <div class="nav-top">
      <div class="brand">
        <h1>Producción</h1>
        <span class="subtitle">Resumen Operativo</span>
      </div>
      <button @click="handleLogout" class="btn-logout">
        Cerrar Sesión
      </button>
    </div>
    <nav class="sub-nav">
      <router-link to="/production/summary" class="nav-item" active-class="active">Órdenes</router-link>
      <router-link to="/production/orders" class="nav-item" active-class="active">Rutas</router-link>
      <router-link to="/production/reports" class="nav-item" active-class="active">Reportes</router-link>
    </nav>
  </header>
</template>

<style lang="scss" scoped>
.navbar {
  background: white;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.nav-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid $border-light;
}

.brand {
  display: flex;
  flex-direction: column;

  h1 {
    margin: 0;
    font-size: 1.25rem;
    color: $NICOLE-PURPLE;
    font-family: $font-principal;
    font-weight: 700;
  }

  .subtitle {
    font-size: 0.8rem;
    color: $text-light;
  }
}

.sub-nav {
  display: flex;
  padding: 0;
  width: 100%;

  .nav-item {
    flex: 1;
    text-align: center;
    text-decoration: none;
    color: $text-light;
    padding: 0.75rem 0;
    font-weight: 500;
    border-bottom: 3px solid transparent; // Thicker border for better visibility active state
    transition: all 0.2s;

    &:hover {
      background-color: rgba($NICOLE-PURPLE, 0.05); // Subtle hover effect
      color: $NICOLE-PURPLE;
    }

    &.active {
      color: $NICOLE-PURPLE;
      border-bottom-color: $NICOLE-PURPLE;
    }
  }
}

.btn-logout {
  padding: 0.5rem 1rem;
  border: 1px solid $error;
  color: $error;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-family: $font-secondary;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: $error;
    color: white;
  }
}
</style>
