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
        <h1>Supply Chain</h1>
        <span class="subtitle">Gestión de Compras</span>
      </div>
      <button @click="handleLogout" class="btn-logout">
        Cerrar Sesión
      </button>
    </div>
    <nav class="sub-nav">
      <router-link to="/supply-chain/summary" class="nav-item" active-class="active">Resumen</router-link>
      <router-link to="/supply-chain/providers" class="nav-item" active-class="active">Proveedores</router-link>
      <router-link to="/supply-chain/materials" class="nav-item" active-class="active">Materia Prima</router-link>
      <router-link to="/supply-chain/warehouse" class="nav-item" active-class="active">Bodega</router-link>
    </nav>
  </header>
</template>

<style lang="scss" scoped>
.navbar {
  background: white;
  padding: 0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); // More subtle shadow
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  z-index: 50; // Ensure it stays on top
}

.nav-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem; // Slightly more padding
  border-bottom: 1px solid $border-light;
}

.brand {
  display: flex;
  flex-direction: column;

  h1 {
    margin: 0;
    font-size: 1.25rem;
    color: $NICOLE-PURPLE;
    font-family: 'Poppins', sans-serif; // Assuming font availability or fallback
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .subtitle {
    font-size: 0.85rem;
    color: $text-light;
    font-weight: 500;
  }
}

.sub-nav {
  display: flex;
  padding: 0;
  width: 100%;
  background-color: $gray-50; // Subtle background for the nav bar

  .nav-item {
    flex: 1;
    text-align: center;
    text-decoration: none;
    color: $text-light;
    padding: 1rem 0; // More comfortable touch target
    font-weight: 600;
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); // Smooth transition
    font-size: 0.95rem;

    // Hover State
    &:hover {
      background-color: rgba($NICOLE-PURPLE, 0.08);
      color: $NICOLE-PURPLE;
    }

    // Active State (router-link-active is automatically applied by Vue Router)
    &.active,
    &.router-link-active {
      color: $NICOLE-PURPLE;
      background-color: white; // Lift active item visually
      border-bottom: 3px solid $NICOLE-PURPLE;
    }

    // Focus State for accessibility
    &:focus-visible {
      outline: 2px solid $NICOLE-PURPLE;
      outline-offset: -2px;
      background-color: rgba($NICOLE-PURPLE, 0.05);
    }
  }
}

.btn-logout {
  padding: 0.6rem 1.2rem;
  border: 1px solid transparent; // Cleaner look
  color: $error;
  background: rgba($error, 0.05);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
  font-size: 0.9rem;

  &:hover {
    background: $error;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba($error, 0.2);
  }

  &:active {
    transform: translateY(0);
  }
}
</style>
