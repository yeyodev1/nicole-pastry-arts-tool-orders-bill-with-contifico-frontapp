<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthService from '@/services/auth.service'

const route = useRoute()
const router = useRouter()

const token = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const isLoading = ref(false)
const isDone = ref(false)

const passwordsMatch = computed(() => password.value === confirmPassword.value)
const isValid = computed(() => password.value.length >= 8 && passwordsMatch.value)

const handleReset = async () => {
  error.value = ''
  if (password.value.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }
  if (!passwordsMatch.value) {
    error.value = 'Las contraseñas no coinciden.'
    return
  }

  isLoading.value = true
  try {
    await AuthService.resetPassword(token.value, password.value)
    isDone.value = true
  } catch (err: any) {
    error.value = err?.message || 'El enlace no es válido o ya expiró. Solicita uno nuevo.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  token.value = (route.query.token as string) || ''
  if (!token.value) {
    error.value = 'Enlace inválido. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".'
  }
})
</script>

<template>
  <div class="reset-container">
    <div class="reset-card">
      <div class="logo-area">
        <h1>Nicole Pastry Arts</h1>
        <p class="subtitle">Restablecer contraseña</p>
      </div>

      <form v-if="!isDone" @submit.prevent="handleReset" class="reset-form">
        <div class="form-group">
          <label for="password">Nueva contraseña</label>
          <input
            type="password"
            id="password"
            v-model="password"
            placeholder="Mínimo 8 caracteres"
            required
            minlength="8"
            :disabled="isLoading || !token"
          />
        </div>

        <div class="form-group">
          <label for="confirm">Repite la contraseña</label>
          <input
            type="password"
            id="confirm"
            v-model="confirmPassword"
            placeholder="••••••••"
            required
            :disabled="isLoading || !token"
          />
          <span v-if="confirmPassword && !passwordsMatch" class="field-hint">
            Las contraseñas no coinciden
          </span>
        </div>

        <div v-if="error" class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          {{ error }}
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading || !isValid || !token">
          <span v-if="!isLoading">Guardar nueva contraseña</span>
          <span v-else class="loader"></span>
        </button>
      </form>

      <div v-else class="success-message">
        <i class="fas fa-check-circle"></i>
        <p>Tu contraseña fue actualizada correctamente.</p>
        <button class="btn-primary" @click="router.push('/login')">Iniciar sesión</button>
      </div>

      <button v-if="!isDone" type="button" class="back-link" @click="router.push('/login')">
        ← Volver a iniciar sesión
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.reset-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: $background-cream;
  background-image: radial-gradient($NICOLE-PURPLE 0.5px, transparent 0.5px), radial-gradient($NICOLE-PURPLE 0.5px, $background-cream 0.5px);
  background-size: 20px 20px;
  background-position: 0 0, 10px 10px;
  padding: 2rem;
}

.reset-card {
  background: white;
  padding: 3rem;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba($NICOLE-PURPLE, 0.1);
  width: 100%;
  max-width: 400px;
  border: 1px solid rgba($NICOLE-PURPLE, 0.05);
}

.logo-area {
  text-align: center;
  margin-bottom: 2rem;

  h1 {
    font-family: $font-principal;
    color: $NICOLE-PURPLE;
    font-size: 1.75rem;
    margin: 0;
  }

  .subtitle {
    font-family: $font-secondary;
    color: $text-light;
    margin-top: 0.5rem;
  }
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.9rem;
    font-weight: 500;
    font-family: $font-secondary;
    color: $text-dark;
  }

  input {
    padding: 0.75rem 1rem;
    border: 1px solid $border-light;
    border-radius: 8px;
    font-family: $font-secondary;
    background-color: $gray-50;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
      background-color: white;
    }
  }

  .field-hint {
    font-size: 0.78rem;
    color: $error;
  }
}

.error-message {
  color: $error;
  font-size: 0.875rem;
  background-color: rgba($error, 0.08);
  border: 1px solid rgba($error, 0.25);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-primary {
  background-color: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.875rem;
  border-radius: 8px;
  font-family: $font-secondary;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;

  &:hover:not(:disabled) { background-color: $purple-dark; }
  &:disabled { opacity: 0.7; cursor: not-allowed; }
}

.success-message {
  text-align: center;
  font-family: $font-secondary;

  i {
    font-size: 2.5rem;
    color: #059669;
    margin-bottom: 0.75rem;
  }

  p {
    color: $text-dark;
    margin: 0 0 1.25rem;
  }
}

.back-link {
  background: none;
  border: none;
  color: $NICOLE-PURPLE;
  font-family: $font-secondary;
  font-size: 0.875rem;
  cursor: pointer;
  display: block;
  margin: 1rem auto 0;

  &:hover { text-decoration: underline; }
}

.loader {
  width: 20px;
  height: 20px;
  border: 2px solid #ffffff;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
