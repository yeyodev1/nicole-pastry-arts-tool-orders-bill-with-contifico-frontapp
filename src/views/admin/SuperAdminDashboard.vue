<script setup lang="ts">
// SuperAdmin Dashboard - Placeholder
</script>

<template>
  <div class="super-admin-dashboard">
    <div class="dashboard-header">
      <h1>Panel de Gerencia</h1>
      <p class="subtitle">Bienvenido al panel de control de Nicole Pastry Arts.</p>
    </div>

    <div class="placeholder-content">
      <div class="info-card">
        <h3>Vista de Superadmin</h3>
        <p>Esta es la vista para gerentes. Actualmente en desarrollo.</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.super-admin-dashboard {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;

  .dashboard-header {
    margin-bottom: 3rem;
    text-align: center;

    h1 {
      font-family: $font-principal;
      color: $NICOLE-PURPLE;
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      font-family: $font-secondary;
      color: $text-light;
      font-size: 1.1rem;
    }
  }

  .placeholder-content {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;

    .info-card {
      background: white;
      padding: 3rem;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba($NICOLE-PURPLE, 0.05);
      text-align: center;
      border: 1px solid rgba($NICOLE-PURPLE, 0.1);
      max-width: 500px;

      h3 {
        color: $NICOLE-PURPLE;
        margin-bottom: 1rem;
        font-size: 1.5rem;
      }

      p {
        color: $text-light;
        font-size: 1rem;
        line-height: 1.6;
      }
    }
  }
}
</style>
