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

const RAW_API_URL = (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || '').trim();
const API_BASE_URL = RAW_API_URL ? `${RAW_API_URL.replace(/\/+$/, '')}/api/v1` : '/api/v1';

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    ...(options.headers || {})
  };

  // Only set application/json if body is not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

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

export async function apiDownload(endpoint, fallbackFilename = 'download.xlsx') {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {};
  if (memoryAccessToken) {
    headers['Authorization'] = `Bearer ${memoryAccessToken}`;
  }

  const response = await fetch(url, { headers, credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to download file (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition');
  let filename = fallbackFilename;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = decodeURIComponent(match[1]);
  }

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}

export async function apiFetchBlob(endpoint, fallbackFilename = 'document.pdf') {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {};
  if (memoryAccessToken) {
    headers['Authorization'] = `Bearer ${memoryAccessToken}`;
  }

  const response = await fetch(url, { headers, credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to load document (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition');
  let filename = fallbackFilename;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = decodeURIComponent(match[1]);
  }

  return { blob, filename };
}
