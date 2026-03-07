<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ProductSearchPanel from './ProductSearchPanel.vue'

const router = useRouter()
const isPanelOpen = ref(false)

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
      <div class="nav-top-actions">
        <button class="btn-catalog" @click="isPanelOpen = true" title="Buscar productos">
          <i class="fas fa-search"></i>
          <span>Buscar productos</span>
        </button>
        <button @click="handleLogout" class="btn-logout">
          Cerrar Sesión
        </button>
      </div>
    </div>
    <nav class="sub-nav">
      <router-link to="/supply-chain/summary" class="nav-item" active-class="active">Inventario</router-link>
      <router-link to="/supply-chain/providers" class="nav-item" active-class="active">Proveedores</router-link>
      <router-link to="/supply-chain/materials" class="nav-item" active-class="active">Materia Prima</router-link>
      <router-link to="/supply-chain/categories" class="nav-item" active-class="active">Categorías</router-link>
      <router-link to="/supply-chain/warehouse" class="nav-item" active-class="active">Bodega</router-link>
    </nav>
  </header>

  <ProductSearchPanel :is-open="isPanelOpen" @close="isPanelOpen = false" />
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

.nav-top-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-catalog {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.1rem;
  border: 1.5px solid rgba($NICOLE-PURPLE, 0.25);
  border-radius: 10px;
  background: rgba($NICOLE-PURPLE, 0.06);
  color: $NICOLE-PURPLE;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;

  span {
    display: none;
    @media (min-width: 640px) { display: inline; }
  }

  &:hover {
    background: $NICOLE-PURPLE;
    border-color: $NICOLE-PURPLE;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.2);
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
