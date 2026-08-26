let refreshPromise = null;

class ApiClient {
  constructor() {
    this.baseURL = '/api';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('accessToken');
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const { signal, ...rest } = options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    if (signal) signal.addEventListener('abort', () => controller.abort());

    const config = {
      ...rest,
      headers,
      signal: controller.signal,
    };

    let response;
    try {
      response = await fetch(url, config);
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
      throw err;
    }
    clearTimeout(timeout);

    // Handle 401 Unauthorized — skip for auth endpoints (login/register)
    const isAuthEndpoint = endpoint.startsWith('/auth/');
    if (response.status === 401 && !options._retry && !isAuthEndpoint) {
      try {
        // Deduplicate concurrent refresh requests — only one refresh in flight at a time
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const rc = new AbortController();
            const rt = setTimeout(() => rc.abort(), 15000);
            let refreshResponse;
            try {
              refreshResponse = await fetch(`${this.baseURL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: rc.signal,
              });
            } finally {
              clearTimeout(rt);
            }
            if (!refreshResponse.ok) throw new Error('Refresh failed');
            const data = await refreshResponse.json();
            return data.data.accessToken;
          })().catch((err) => {
            throw err;
          }).finally(() => {
            refreshPromise = null;
          });
        }

        const newToken = await refreshPromise;
        localStorage.setItem('accessToken', newToken);
        headers.Authorization = `Bearer ${newToken}`;
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 30000);
        try {
          response = await fetch(url, { ...config, headers, signal: retryController.signal });
        } finally {
          clearTimeout(retryTimeout);
        }
      } catch (err) {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.error?.message || 'API Request Failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data?.data !== undefined ? data.data : data;
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  patch(endpoint, body) {
    return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
