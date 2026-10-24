/**
 * API Client Library with automatic token refresh and error normalization
 */

let memoryAccessToken = null;

export function setAccessToken(token) {
  memoryAccessToken = token;
}

export function getAccessToken() {
  return memoryAccessToken;
}

const API_BASE_URL = '/api/v1';

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (memoryAccessToken) {
    headers['Authorization'] = `Bearer ${memoryAccessToken}`;
  }

  const fetchConfig = {
    ...options,
    headers,
    credentials: 'include' // Sends cookies
  };

  let response = await fetch(url, fetchConfig);

  // Auto-refresh token if 401 received and not already on auth endpoint
  if (response.status === 401 && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/refresh')) {
    try {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.data && refreshData.data.accessToken) {
          setAccessToken(refreshData.data.accessToken);
          headers['Authorization'] = `Bearer ${refreshData.data.accessToken}`;
          // Retry original request
          response = await fetch(url, { ...fetchConfig, headers });
        }
      }
    } catch (e) {
      // Refresh failed
      setAccessToken(null);
    }
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    const errorMsg = (data && data.message) || `HTTP ${response.status}: Request failed`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}
