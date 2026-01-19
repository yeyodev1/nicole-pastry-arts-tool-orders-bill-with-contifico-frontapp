<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const logout = () => {
  localStorage.removeItem('access_token')
  router.push('/login')
}
</script>

<template>
  <nav class="navbar">
    <div class="container">
      <div class="brand">
        <router-link to="/orders">Nicole Pastry Arts</router-link>
      </div>
      
      <div class="nav-links">
        <router-link to="/orders" active-class="active">Pedidos</router-link>
        <router-link to="/orders/new" active-class="active">Nuevo Pedido</router-link>
        <router-link to="/reports/sales-by-responsible" active-class="active">Reportes</router-link>
      </div>

      <div class="user-actions">
        <button @click="logout" class="btn-logout">Cerrar Sesión</button>
      </div>
    </div>
  </nav>
</template>

<style lang="scss" scoped>
.navbar {
  background: white;
  border-bottom: 1px solid $border-light;
  padding: 0.75rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);

  .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }

  .brand {
    a {
      font-family: $font-principal;
      font-size: 1.25rem;
      color: $NICOLE-PURPLE;
      text-decoration: none;
      font-weight: 700;
    }
  }

  .nav-links {
    display: flex;
    gap: 2rem;

    a {
      text-decoration: none;
      color: $text-light;
      font-weight: 500;
      font-size: 0.95rem;
      padding: 0.5rem 0;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;

      &:hover {
        color: $NICOLE-PURPLE;
      }

      &.active {
        color: $NICOLE-PURPLE;
        border-bottom-color: $NICOLE-PURPLE;
      }
    }
  }

  .btn-logout {
    background: transparent;
    border: 1px solid $border-light;
    padding: 0.4rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    color: $text-light;
    font-size: 0.85rem;
    transition: all 0.2s;

    &:hover {
      border-color: $NICOLE-PURPLE;
      color: $NICOLE-PURPLE;
    }
  }
}

@media (max-width: 768px) {
  .nav-links {
    display: none !important; // Simple mobile hide for now
  }
}
</style>
