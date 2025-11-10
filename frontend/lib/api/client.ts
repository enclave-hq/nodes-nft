/**
 * Backend API Client
 * 
 * This module provides a client for calling the NestJS backend API.
 * It handles authentication, error handling, and request/response formatting.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Custom error class for API errors
 * This ensures error objects are properly recognized as Error instances
 */
export class ApiError extends Error {
  statusCode?: number;
  error?: string;

  constructor(message: string, statusCode?: number, error?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
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
      throw new ApiError('Unauthorized - please login again', 401, 'UNAUTHORIZED');
    }

    // Handle errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText,
        statusCode: response.status,
      }));
      
      throw new ApiError(
        errorData.message || errorData.error || 'Request failed',
        response.status,
        errorData.error,
      );
    }

    // Return JSON data
    const data = await response.json();
    return data as T;
  } catch (error) {
    // Re-throw ApiError instances (already properly formatted)
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle network errors (fetch failures)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        'Network error: Unable to connect to API server. Please check if the backend is running.',
        0,
        'NETWORK_ERROR',
      );
    }
    
    // Handle other fetch-related errors
    if (error instanceof Error && (error.message === 'Failed to fetch' || error.message.includes('fetch'))) {
      throw new ApiError(
        'Network error: Unable to connect to API server. Please check if the backend is running.',
        0,
        'NETWORK_ERROR',
      );
    }
    
    // Re-throw other Error instances (preserve original error)
    if (error instanceof Error) {
      throw error;
    }
    
    // Handle unknown errors (non-Error objects)
    throw new ApiError('Unknown error occurred', 0, 'UNKNOWN_ERROR');
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

