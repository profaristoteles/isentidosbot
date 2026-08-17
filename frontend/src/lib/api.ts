import axios from 'axios';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Se estiver rodando no domínio de produção (isentidos.com.br ou isppreparatorios.com.br)
    if (host.includes('isentidos.com.br') || host.includes('isppreparatorios.com.br')) {
      const apiHost = host.includes('isentidosbot') 
        ? host.replace('isentidosbot', 'isentidosbot-api')
        : 'isentidosbot-api.isentidos.com.br';
      return `${protocol}//${apiHost}/api`;
    }
  }

  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
};

const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('isentidos_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Redirecionar para login apenas se não estiver já na página de login
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('isentidos_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
