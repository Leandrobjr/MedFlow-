import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  withCredentials: true, // Importante para enviar os cookies HttpOnly
});

// Interceptor para capturar erros 401 (não autorizado) e tentar refresh ou deslogar
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Evitar loop: não tentar refresh se já estiver na página de login
    const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';
    
    if (error.response?.status === 401 && !error.config._retry && !isLoginPage) {
      error.config._retry = true;
      try {
        await axios.post('http://localhost:3001/auth/refresh', {}, { withCredentials: true });
        return api(error.config);
      } catch (refreshError) {
        // Se o refresh falhar, redireciona para login apenas se não estiver lá
        if (typeof window !== 'undefined' && !isLoginPage) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);


