import { ref, readonly } from 'vue';
import { useRouter } from 'vue-router';

// Global state
const isSessionExpired = ref(false);
const countdown = ref(5);
let intervalId: number | null = null;

export function useSessionExpired() {
  const router = useRouter();

  const startCountdown = () => {
    if (intervalId) return; // Already running

    countdown.value = 5;
    intervalId = window.setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        logoutAndRedirect();
      }
    }, 1000);
  };

  const logoutAndRedirect = () => {
    stopCountdown();
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    isSessionExpired.value = false;

    // Redirect logic
    // We can use window.location to force full reload and clear state
    window.location.href = '/login';
  };

  const stopCountdown = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const triggerExpiry = () => {
    if (isSessionExpired.value) return; // Already triggered
    isSessionExpired.value = true;
    startCountdown();
  };

  const logoutNow = () => {
    logoutAndRedirect();
  };

  return {
    isSessionExpired: readonly(isSessionExpired),
    countdown: readonly(countdown),
    triggerExpiry,
    logoutNow
  };
}
