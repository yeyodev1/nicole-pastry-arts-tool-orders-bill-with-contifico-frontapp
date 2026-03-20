import { ref, computed } from 'vue'
import BranchService, { type Branch } from '@/services/branch.service'

// Module-level singleton — shared across all components
const _branches = ref<Branch[]>([])
const _loaded = ref(false)
const _loading = ref(false)

export function useBranches() {
  const load = async (force = false) => {
    if (_loaded.value && !force) return
    _loading.value = true
    try {
      _branches.value = await BranchService.getBranches()
      _loaded.value = true
    } catch (e) {
      console.error('Error loading branches:', e)
    } finally {
      _loading.value = false
    }
  }

  const activeBranches = computed(() =>
    _branches.value.filter(b => b.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  )

  const branchNames = computed(() =>
    activeBranches.value.map(b => b.name)
  )

  return {
    branches: _branches,
    activeBranches,
    branchNames,
    isLoading: _loading,
    load,
  }
}
