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

    const config = {
      ...options,
      headers,
    };

    let response = await fetch(url, config);

    // Handle 401 Unauthorized — skip for auth endpoints (login/register)
    const isAuthEndpoint = endpoint.startsWith('/auth/');
    if (response.status === 401 && !options._retry && !isAuthEndpoint) {
      options._retry = true;
      try {
        const refreshResponse = await fetch(`${this.baseURL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          localStorage.setItem('accessToken', data.data.accessToken);
          // Retry the original request with the new token
          headers.Authorization = `Bearer ${data.data.accessToken}`;
          response = await fetch(url, { ...config, headers });
        } else {
          // Refresh failed, clear token and redirect
          localStorage.removeItem('accessToken');
          window.location.href = '/login';
          throw new Error('Session expired. Please log in again.');
        }
      } catch (err) {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        throw err;
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
