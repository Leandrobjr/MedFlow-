import axios from 'axios';

// Detectar automaticamente o IP do servidor baseado no hostname atual
const getApiUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  
  // Se estiver em localhost, usar localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  
  // Se estiver acessando via IP, usar o mesmo IP para a API
  const hostname = window.location.hostname;
  return `http://${hostname}:3001`;
};

export const api = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true, // Importante para enviar os cookies HttpOnly
});

// Interceptor de request para adicionar header x-tenant-slug (DEV-only, controlado por env)
api.interceptors.request.use(
  (config) => {
    // FASE 3.5: Segurança do Frontend - header x-tenant-slug apenas quando explicitamente permitido
    if (typeof window !== 'undefined') {
      // Verificar se o header é permitido via variável de ambiente (default: false)
      const allowTenantHeader = process.env.NEXT_PUBLIC_ALLOW_TENANT_HEADER === 'true';
      
      if (allowTenantHeader) {
        // Header permitido: verificar se NEXT_PUBLIC_TENANT_SLUG está configurado
        const tenantSlug = process.env.NEXT_PUBLIC_TENANT_SLUG;
        
        if (!tenantSlug) {
          // Erro de configuração: não usar fallback, mostrar erro no console
          console.error(
            '[API] ❌ Erro de configuração: NEXT_PUBLIC_ALLOW_TENANT_HEADER=true mas NEXT_PUBLIC_TENANT_SLUG não está definido. ' +
            'Configure NEXT_PUBLIC_TENANT_SLUG no arquivo .env.local ou remova NEXT_PUBLIC_ALLOW_TENANT_HEADER.'
          );
          // Não enviar header se não estiver configurado corretamente
        } else {
          // Configuração correta: enviar header
          config.headers['x-tenant-slug'] = tenantSlug;
          console.log(`[API] Enviando header x-tenant-slug: ${tenantSlug} para ${config.url}`);
        }
      } else {
        // Header não permitido: não enviar header nenhum
        // O tenant deve vir do host/subdomínio ou configuração do ambiente
        // (comportamento padrão e seguro)
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para capturar erros 401 (não autorizado) e tentar refresh ou deslogar
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Evitar loop: não tentar refresh se já estiver na página de login
    const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';
    
    if (error.response?.status === 401 && !error.config._retry && !isLoginPage) {
      error.config._retry = true;
      try {
        // Usar a instância api (o interceptor de request cuidará do header x-tenant-slug se permitido)
        await api.post('/auth/refresh', {}, { withCredentials: true });
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
