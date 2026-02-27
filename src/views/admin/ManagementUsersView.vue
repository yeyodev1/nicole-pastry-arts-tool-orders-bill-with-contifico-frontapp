<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import UserService from '@/services/user.service'
import type { User } from '@/types/user'
import { useToast } from '@/composables/useToast'
import SearchableSelect from '@/components/ui/SearchableSelect.vue'
import UserDeleteModal from './components/UserDeleteModal.vue'

const { success, error: showError } = useToast()
const users = ref<User[]>([])
const isLoading = ref(false)

// Logged-in user protection
const loggedInUserId = computed(() => {
  try {
    const info = localStorage.getItem('user_info')
    return info ? JSON.parse(info)?._id?.toString() : null
  } catch { return null }
})

const loggedInEmail = computed(() => {
  try {
    const info = localStorage.getItem('user_info')
    return info ? JSON.parse(info)?.email : null
  } catch { return null }
})

// Returns true if the given user is the one currently logged in
const isSelf = (user: User) => {
  const userId = (user as any)._id?.toString()
  const matchById = loggedInUserId.value && userId === loggedInUserId.value
  const matchByEmail = loggedInEmail.value && user.email === loggedInEmail.value
  return !!(matchById || matchByEmail)
}
const showModal = ref(false)
const isEditing = ref(false)
const showDeleteModal = ref(false)
const showSelfDeleteModal = ref(false)
const userToDelete = ref<User | null>(null)
const currentUser = ref<Partial<User>>({
  name: '',
  email: '',
  password: '',
  role: 'SALES_REP'
})

const ALL_ROLES = [
  { value: 'SALES_REP', label: 'Vendedor (Rep)' },
  { value: 'SALES_MANAGER', label: 'Gerente de Ventas' },
  { value: 'admin', label: 'Administrador' },
  { value: 'production', label: 'Producción' },
  { value: 'RetailManager', label: 'Gerente Retail' },
  { value: 'SUPPLY_CHAIN_MANAGER', label: 'Gerente Logística' }
]

const filteredRoles = computed(() => {
  try {
    const userInfoStr = localStorage.getItem('user_info')
    if (!userInfoStr) return ALL_ROLES

    const user = JSON.parse(userInfoStr)
    const role = user.role?.toUpperCase()

    // Only full admins see everything
    if (role === 'ADMIN' || role === 'admin') {
      return ALL_ROLES
    }

    // Sales Managers and any other role authorized to be here
    // can only create/manage Sales Reps and other Sales Managers
    return ALL_ROLES.filter(r => ['SALES_REP', 'SALES_MANAGER'].includes(r.value))
  } catch (e) {
    console.error('Error parsing user_info:', e)
    return ALL_ROLES.filter(r => ['SALES_REP', 'SALES_MANAGER'].includes(r.value))
  }
})

const fetchUsers = async () => {
  isLoading.value = true
  try {
    users.value = await UserService.getAllUsers()
  } catch (e) {
    showError('Error al cargar la lista de equipo')
  } finally {
    isLoading.value = false
  }
}

const openCreateModal = () => {
  isEditing.value = false
  currentUser.value = {
    name: '',
    email: '',
    password: '',
    role: 'SALES_REP'
  }
  showModal.value = true
}

const openEditModal = (user: User) => {
  isEditing.value = true
  currentUser.value = { ...user, password: '' }
  showModal.value = true
}

const handleSave = async () => {
  try {
    if (isEditing.value && (currentUser.value as any)._id) {
      await UserService.updateUser((currentUser.value as any)._id, currentUser.value)
      success('Perfil de equipo actualizado')
    } else {
      await UserService.createUser(currentUser.value)
      success('Nuevo integrante añadido al equipo')
    }
    showModal.value = false
    await fetchUsers()
  } catch (e: any) {
    // httpBase throws { status, message, data } - not standard axios shape
    const errorMsg = e.data?.message || e.message || ''
    if (errorMsg === 'EMAIL_ALREADY_REGISTERED') {
      showError('Este correo ya se encuentra registrado en el sistema')
    } else {
      showError(errorMsg || 'Error al guardar cambios')
    }
  }
}

const handleDelete = (user: User) => {
  // If trying to delete self, show funny guard modal
  if (isSelf(user)) {
    showSelfDeleteModal.value = true
    return
  }
  userToDelete.value = user
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  const userId = (userToDelete.value as any)?._id
  if (!userId) {
    showError('No se encontró el ID del usuario para eliminar.')
    showDeleteModal.value = false
    userToDelete.value = null
    return
  }

  try {
    await UserService.deleteUser(userId)
    success('Colaborador removido exitosamente')
    await fetchUsers()
  } catch (e: any) {
    console.error('Delete error:', e)
    showError(e.message || 'No se pudo remover al usuario. Intente nuevamente.')
  } finally {
    showDeleteModal.value = false
    userToDelete.value = null
  }
}

const getRoleLabel = (roleValue: string) => {
  return ALL_ROLES.find(r => r.value === roleValue)?.label || roleValue
}

onMounted(fetchUsers)
</script>

<template>
  <div class="management-container">
    <!-- Premium Header Section -->
    <header class="page-header">
      <div class="header-content">
        <h1 class="gradient-title">Gestión de Equipo</h1>
        <p class="subtitle">Administra los accesos y roles de tu fuerza de ventas y personal.</p>
      </div>
      <button @click="openCreateModal" class="btn-add-user">
        <div class="icon-circle">
          <i class="fa-solid fa-plus"></i>
        </div>
        <span>Añadir Integrante</span>
      </button>
    </header>

    <!-- Stats Bar (Optional, for premium feel) -->
    <div class="team-stats">
      <div class="stat-item">
        <span class="stat-value">{{ users.length }}</span>
        <span class="stat-label">Total Miembros</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{users.filter(u => u.role === 'SALES_REP').length}}</span>
        <span class="stat-label">Vendedores</span>
      </div>
    </div>

    <div v-if="isLoading" class="loader-container">
      <div class="premium-spinner"></div>
      <p>Sincronizando equipo...</p>
    </div>

    <!-- User Grid -->
    <div v-else class="users-grid">
      <TransitionGroup name="list">
        <div v-for="user in users" :key="(user as any)._id" class="glass-card user-card" :class="{ 'is-self': isSelf(user) }">
          <div class="card-top">
             <!-- Self profile badge -->
             <span v-if="isSelf(user)" class="self-badge">
               <i class="fa-solid fa-shield-halved"></i> Tu Perfil
             </span>
             <div class="avatar-wrapper">
                <div class="avatar-gradient">
                  {{ user.name.charAt(0).toUpperCase() }}
                </div>
                <div class="status-indicator"></div>
             </div>
             <div class="dropdown-actions">
                <button @click="openEditModal(user)" class="action-btn" title="Editar">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button @click="handleDelete(user)" class="action-btn danger" title="Eliminar">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
             </div>
          </div>

          <div class="card-info">
            <h3 class="user-name">{{ user.name }}</h3>
            <p class="user-email">{{ user.email }}</p>
            <div class="badge-row">
              <span class="role-badge-premium" :class="user.role.toLowerCase()">
                {{ getRoleLabel(user.role) }}
              </span>
            </div>
          </div>
          
          <div class="card-footer">
            <span class="since">Miembro desde {{ new Date(user.createdAt || '').toLocaleDateString('es-EC', { month: 'short', year: 'numeric' }) }}</span>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Premium Modal -->
    <Transition name="fade">
      <div v-if="showModal" class="premium-overlay" @click.self="showModal = false">
        <div class="premium-modal">
          <div class="modal-header">
            <div class="modal-title-group">
                <i class="fa-solid" :class="isEditing ? 'fa-user-pen' : 'fa-user-plus'"></i>
                <h2>{{ isEditing ? 'Actualizar Perfil' : 'Nuevo Integrante' }}</h2>
            </div>
            <button class="close-modal" @click="showModal = false">&times;</button>
          </div>

          <form @submit.prevent="handleSave" class="premium-form">
            <div class="form-row">
              <div class="form-field">
                <label>Nombre Completo</label>
                <div class="input-container">
                  <i class="fa-solid fa-user"></i>
                  <input v-model="currentUser.name" placeholder="Ej: Juan Pérez" required />
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label>Email Corporativo</label>
                <div class="input-container">
                  <i class="fa-solid fa-envelope"></i>
                  <input v-model="currentUser.email" type="email" placeholder="email@nicole.com.ec" required />
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label>{{ isEditing ? 'Cambiar Contraseña' : 'Establecer Contraseña' }}</label>
                <div class="input-container">
                  <i class="fa-solid fa-lock"></i>
                  <input v-model="currentUser.password" type="password" :placeholder="isEditing ? 'Dejar vacío para no cambiar' : '••••••••'" :required="!isEditing" />
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label>Asignar Rol</label>
                <SearchableSelect 
                  v-model="currentUser.role"
                  :options="filteredRoles"
                  placeholder="Seleccionar rol de equipo..."
                />
              </div>
            </div>

            <div class="form-actions">
              <button type="button" @click="showModal = false" class="btn-cancel">Cancelar</button>
              <button type="submit" class="btn-save">
                {{ isEditing ? 'Guardar Cambios' : 'Confirmar Registro' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <!-- Hold-to-Delete Modal -->
    <UserDeleteModal 
      :is-open="showDeleteModal"
      :user-name="userToDelete?.name || ''"
      @close="showDeleteModal = false"
      @confirm="confirmDelete"
    />

    <!-- Funny Self-Delete Guard Modal -->
    <Transition name="fade">
      <div v-if="showSelfDeleteModal" class="premium-overlay" @click.self="showSelfDeleteModal = false">
        <div class="self-delete-modal">
          <div class="chaos-icon">
            <span>&#128562;</span>
          </div>
          <h2>&#128165; Woah, woah, woah...</h2>
          <p class="chaos-text">
            ¿Borrarte a <strong>ti mismo</strong>?<br/>
            ¿Quieres destruir la empresa desde adentro?<br/>
            ¡No seas caos en zapatos! 👟
          </p>
          <p class="chaos-sub">Si de verdad quieres salir... <em>cierra sesión como una persona normal.</em></p>
          <button class="btn-chaos-ok" @click="showSelfDeleteModal = false">
            <i class="fa-solid fa-hand"></i> Ok, me tranquilizo
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.management-container {
  padding: 3rem 2rem;
  max-width: 1300px;
  margin: 0 auto;
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;

  @media(max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1.5rem;
  }
}

.gradient-title {
  background: linear-gradient(135deg, $NICOLE-PURPLE, #7c3aed);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: $font-principal;
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  letter-spacing: -1px;
}

.subtitle {
  color: #64748b;
  font-size: 1.1rem;
  margin-top: 0.5rem;
}

.btn-add-user {
  background: $NICOLE-PURPLE;
  color: white;
  border: none;
  padding: 0.5rem 1.5rem 0.5rem 0.5rem;
  border-radius: 50px;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 20px rgba($NICOLE-PURPLE, 0.2);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 15px 25px rgba($NICOLE-PURPLE, 0.3);
    background: darken($NICOLE-PURPLE, 5%);
  }

  .icon-circle {
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.team-stats {
  display: flex;
  gap: 3rem;
  margin-bottom: 3rem;
  padding: 1.5rem 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #f1f5f9;

  .stat-item {
    display: flex;
    flex-direction: column;

    .stat-value {
      font-size: 2rem;
      font-weight: 800;
      color: #1e293b;
    }

    .stat-label {
      font-size: 0.85rem;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
}

.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.user-card {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #f1f5f9;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &.is-self {
    border-color: rgba($NICOLE-PURPLE, 0.3);
    box-shadow: 0 4px 12px rgba($NICOLE-PURPLE, 0.1);
  }

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    border-color: rgba($NICOLE-PURPLE, 0.2);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, #8b5cf6, $NICOLE-PURPLE);
    opacity: 0;
    transition: opacity 0.3s;
  }

  &.is-self::before {
    opacity: 1;
  }

  &:hover::before {
    opacity: 1;
  }
}

.self-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: linear-gradient(135deg, $NICOLE-PURPLE, #7c3aed);
  color: white;
  font-size: 0.7rem;
  font-weight: 800;
  padding: 0.35rem 0.75rem;
  border-radius: 50px;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  box-shadow: 0 4px 10px rgba($NICOLE-PURPLE, 0.3);
  z-index: 1;
}

.glass-card {
  background: white;
  backdrop-filter: blur(8px);
  border-radius: 20px;
  padding: 1.5rem;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.avatar-wrapper {
  position: relative;

  .avatar-gradient {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, $NICOLE-PURPLE, #a855f7);
    color: white;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    font-weight: 800;
    box-shadow: 0 8px 16px rgba($NICOLE-PURPLE, 0.2);
  }

  .status-indicator {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 14px;
    height: 14px;
    background: #10b981;
    border: 3px solid white;
    border-radius: 50%;
  }
}

.dropdown-actions {
  display: flex;
  gap: 0.5rem;

  .action-btn {
    width: 36px;
    height: 36px;
    border: none;
    background: #f8faec;
    border-radius: 10px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba($NICOLE-PURPLE, 0.1);
      color: $NICOLE-PURPLE;
      transform: scale(1.1);
    }

    &.danger:hover {
      background: #fef2f2;
      color: #ef4444;
    }
  }
}

.card-info {
  .user-name {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
  }

  .user-email {
    color: #64748b;
    font-size: 0.95rem;
    margin: 0.25rem 0 1rem;
  }
}

.role-badge-premium {
  padding: 0.4rem 0.8rem;
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;

  &.sales_manager {
    background: #eff6ff;
    color: #2563eb;
  }

  &.sales_rep {
    background: #f0fdf4;
    color: #16a34a;
  }

  &.admin {
    background: #fff1f2;
    color: #e11d48;
  }

  &.retailmanager {
    background: #faf5ff;
    color: #7c3ade;
  }

  &.supply_chain_manager {
    background: #fff7ed;
    color: #ea580c;
  }
}

.card-footer {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;

  .since {
    font-size: 0.8rem;
    color: #94a3b8;
    font-weight: 500;
  }
}

/* Modal Premium Styles */
.premium-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1.5rem;
}

.premium-modal {
  background: white;
  width: 100%;
  max-width: 550px;
  border-radius: 24px;
  position: relative;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: modalEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  padding: 2rem;
  background: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;

  .modal-title-group {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: $NICOLE-PURPLE;

    i {
      font-size: 1.5rem;
    }

    h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 800;
      color: #1e293b;
    }
  }

  .close-modal {
    background: none;
    border: none;
    font-size: 2rem;
    color: #94a3b8;
    cursor: pointer;
    line-height: 1;

    &:hover {
      color: #1e293b;
    }
  }
}

.premium-form {
  padding: 2rem;
  padding-bottom: 3rem; // Added more space at the bottom

  .form-row {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    font-size: 0.9rem;
    font-weight: 700;
    color: #475569;
    margin-bottom: 0.5rem;
  }

  .input-container {
    position: relative;
    display: flex;
    align-items: center;

    i {
      position: absolute;
      left: 1.25rem;
      color: #94a3b8;
      transition: color 0.2s;
    }

    input,
    select {
      width: 100%;
      padding: 1rem 1rem 1rem 3.5rem;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 1rem;
      font-family: inherit;
      transition: all 0.2s;

      &:focus {
        border-color: $NICOLE-PURPLE;
        outline: none;
        box-shadow: 0 0 0 4px rgba($NICOLE-PURPLE, 0.1);
        background: white;
      }

      &:focus+i {
        color: $NICOLE-PURPLE;
      }
    }
  }
}

.form-actions {
  display: flex;
  gap: 1.5rem;
  margin-top: 2.5rem;

  button {
    flex: 1;
    padding: 1rem;
    border-radius: 14px;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s;
  }

  .btn-cancel {
    background: #f1f5f9;
    color: #64748b;
    border: none;

    &:hover {
      background: #e2e8f0;
    }
  }

  .btn-save {
    background: $NICOLE-PURPLE;
    color: white;
    border: none;
    box-shadow: 0 8px 16px rgba($NICOLE-PURPLE, 0.2);

    &:hover {
      background: darken($NICOLE-PURPLE, 5%);
      transform: translateY(-2px);
      box-shadow: 0 12px 20px rgba($NICOLE-PURPLE, 0.3);
    }
  }
}

.loader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10rem 0;
  gap: 1.5rem;
  color: #94a3b8;
}

.premium-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f1f5f9;
  border-top-color: $NICOLE-PURPLE;
  border-radius: 50%;
  animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Animations */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// Funny Self-Delete Guard Modal
.self-delete-modal {
  background: white;
  width: 95%;
  max-width: 420px;
  border-radius: 28px;
  padding: 3rem 2.5rem 2.5rem;
  text-align: center;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.3);
  border: 2px solid #fde68a;
  animation: modalEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1);

  .chaos-icon {
    font-size: 5rem;
    line-height: 1;
    margin-bottom: 1rem;
    animation: shake 0.6s ease infinite;
  }

  h2 {
    font-size: 1.8rem;
    font-weight: 800;
    color: #1e293b;
    margin: 0 0 1.25rem;
    letter-spacing: -0.5px;
  }

  .chaos-text {
    font-size: 1rem;
    color: #374151;
    line-height: 1.8;
    margin-bottom: 1rem;

    strong {
      color: #dc2626;
      font-weight: 900;
    }
  }

  .chaos-sub {
    font-size: 0.85rem;
    color: #94a3b8;
    font-style: italic;
    margin-bottom: 2rem;

    em {
      font-weight: 700;
      color: $NICOLE-PURPLE;
    }
  }

  .btn-chaos-ok {
    background: linear-gradient(135deg, $NICOLE-PURPLE, #a855f7);
    color: white;
    border: none;
    padding: 1rem 2.5rem;
    border-radius: 14px;
    font-weight: 800;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    box-shadow: 0 8px 20px rgba($NICOLE-PURPLE, 0.3);

    &:hover {
      transform: translateY(-2px) scale(1.03);
      box-shadow: 0 14px 28px rgba($NICOLE-PURPLE, 0.4);
    }
  }
}

@keyframes shake {

  0%,
  100% {
    transform: rotate(0deg);
  }

  20% {
    transform: rotate(-8deg);
  }

  40% {
    transform: rotate(8deg);
  }

  60% {
    transform: rotate(-4deg);
  }

  80% {
    transform: rotate(4deg);
  }
}
</style>
