<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthService from '@/services/auth.service'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  error.value = ''
  isLoading.value = true

  try {
    const response = await AuthService.login({
      email: email.value.toLowerCase(),
      password: password.value
    })

    if (response && response.token) {
      localStorage.setItem('access_token', response.token)
      if (response.user) {
        localStorage.setItem('user_info', JSON.stringify(response.user))
      }
      router.push('/')
    }
  } catch (err: any) {
    if (err.status === 401 || err.message === 'USER_NOT_FOUND' || err.message === 'PASSWORD_INCORRECT') {
      error.value = 'Credenciales incorrectas. Por favor verifique.'
    } else {
      error.value = 'Ocurrió un error al iniciar sesión. Intente nuevamente.'
    }
    console.error(err)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo-area">
        <h1>Nicole Pastry Arts</h1>
        <p class="subtitle">Sistema de Pedidos</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email">Correo Electrónico</label>
          <input 
            type="email" 
            id="email" 
            v-model="email" 
            placeholder="ej. ventas@nicole.com.ec"
            required
            :disabled="isLoading"
          />
        </div>

        <div class="form-group">
          <label for="password">Contraseña</label>
          <input 
            type="password" 
            id="password" 
            v-model="password" 
            placeholder="••••••••"
            required
            :disabled="isLoading"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading">
          <span v-if="!isLoading">Iniciar Sesión</span>
          <span v-else class="loader"></span>
        </button>
      </form>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-container {
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

.login-card {
  background: white;
  padding: 3rem;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba($NICOLE-PURPLE, 0.1);
  width: 100%;
  max-width: 400px;
  border: 1px solid rgba($NICOLE-PURPLE, 0.05);

  .logo-area {
    text-align: center;
    margin-bottom: 2.5rem;

    h1 {
      font-family: $font-principal;
      color: $NICOLE-PURPLE;
      font-size: 2rem;
      margin: 0;
      line-height: 1.2;
    }

    .subtitle {
      font-family: $font-secondary;
      color: $text-light;
      margin-top: 0.5rem;
      font-size: 1rem;
    }
  }
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
    transition: all 0.3s ease;
    background-color: $gray-50;

    &:focus {
      outline: none;
      border-color: $NICOLE-PURPLE;
      box-shadow: 0 0 0 3px rgba($NICOLE-PURPLE, 0.1);
      background-color: white;
    }

    &::placeholder {
      color: $gray-400;
    }
  }
}

.error-message {
  color: $error;
  font-size: 0.875rem;
  background-color: rgba($error, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  text-align: center;
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
  transition: all 0.2s ease;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    background-color: $purple-dark;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.2);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

.loader {
  width: 20px;
  height: 20px;
  border: 2px solid #ffffff;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 2rem;
  }
}
</style>
