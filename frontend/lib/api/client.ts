/**
 * Backend API Client
 * 
 * This module provides a client for calling the NestJS backend API.
 * It handles authentication, error handling, and request/response formatting.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
}

/**
 * Get stored JWT token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

/**
 * Store JWT token in localStorage
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_token', token);
}

/**
 * Remove JWT token from localStorage
 */
export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_token');
}

/**
 * Make an API request with authentication
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle unauthorized - clear token
    if (response.status === 401) {
      removeAuthToken();
      throw new Error('Unauthorized - please login again');
    }

    // Handle errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText,
        statusCode: response.status,
      }));
      
      const error: ApiError = {
        message: errorData.message || errorData.error || 'Request failed',
        statusCode: response.status,
        error: errorData.error,
      };
      
      throw error;
    }

    // Return JSON data
    const data = await response.json();
    return data as T;
  } catch (error) {
    // Handle network errors (fetch failures)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const networkError: ApiError = {
        message: 'Network error: Unable to connect to API server. Please check if the backend is running.',
        statusCode: 0,
        error: 'NETWORK_ERROR',
      };
      throw networkError;
    }
    
    // Handle other fetch-related errors
    if (error instanceof Error && (error.message === 'Failed to fetch' || error.message.includes('fetch'))) {
      const networkError: ApiError = {
        message: 'Network error: Unable to connect to API server. Please check if the backend is running.',
        statusCode: 0,
        error: 'NETWORK_ERROR',
      };
      throw networkError;
    }
    
    // Re-throw known errors
    if (error instanceof Error) {
      throw error;
    }
    
    // Handle unknown errors
    throw new Error('Unknown error occurred');
  }
}

/**
 * GET request
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET' });
}

/**
 * POST request
 */
export async function apiPost<T>(
  endpoint: string,
  data?: unknown
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request
 */
export async function apiPatch<T>(
  endpoint: string,
  data?: unknown
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
}

