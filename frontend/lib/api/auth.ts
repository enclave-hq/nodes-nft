/**
 * Authentication API
 */

import { apiPost } from './client';
import { setAuthToken, removeAuthToken } from './client';

export interface LoginRequest {
  address: string;
  signature?: string;
}

export interface LoginResponse {
  access_token: string;
  address: string;
}

/**
 * Login with address and optional signature
 */
export async function login(address: string, signature?: string): Promise<LoginResponse> {
  const response = await apiPost<LoginResponse>('/admin/auth/login', {
    address,
    signature,
  });
  
  // Store token
  if (response.access_token) {
    setAuthToken(response.access_token);
  }
  
  return response;
}

/**
 * Logout - clear token
 */
export function logout(): void {
  removeAuthToken();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('admin_token');
  return !!token;
}

