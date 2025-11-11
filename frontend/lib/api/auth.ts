/**
 * Authentication API
 */

import { apiPost, apiGet } from './client';
import { setAuthToken, removeAuthToken } from './client';

export interface LoginRequest {
  username: string;
  password: string;
  totpCode?: string;
}

export interface LoginResponse {
  access_token: string;
  username: string;
}

export interface SetupTotpResponse {
  secret: string;
  qrCode: string;
  otpauthUrl: string;
}

export interface TotpStatusResponse {
  totpEnabled: boolean;
}

export interface CurrentUserResponse {
  username: string;
}

/**
 * Get current authenticated user info
 */
export async function getCurrentUser(): Promise<CurrentUserResponse> {
  return apiGet<CurrentUserResponse>('/admin/auth/me');
}

/**
 * Check if TOTP is enabled for a username
 * This allows the frontend to pre-show TOTP input field
 */
export async function checkTotpStatus(username: string): Promise<TotpStatusResponse> {
  if (!username) {
    return { totpEnabled: false };
  }
  return apiGet<TotpStatusResponse>(`/admin/auth/check-totp?username=${encodeURIComponent(username)}`);
}

/**
 * Login with username, password and optional TOTP code
 */
export async function login(username: string, password: string, totpCode?: string): Promise<LoginResponse> {
  const response = await apiPost<LoginResponse>('/admin/auth/login', {
    username,
    password,
    totpCode,
  });
  
  // Store token
  if (response.access_token) {
    setAuthToken(response.access_token);
  }
  
  return response;
}

/**
 * Setup TOTP (generate secret and QR code)
 */
export async function setupTotp(username: string, password: string): Promise<SetupTotpResponse> {
  return apiPost<SetupTotpResponse>('/admin/auth/totp/setup', {
    username,
    password,
  });
}

/**
 * Enable TOTP after verification
 */
export async function enableTotp(username: string, password: string, totpCode: string, secret: string): Promise<{ success: boolean; message: string }> {
  return apiPost('/admin/auth/totp/enable', {
    username,
    password,
    totpCode,
    secret,
  });
}

/**
 * Disable TOTP
 */
export async function disableTotp(username: string, password: string): Promise<{ success: boolean; message: string }> {
  return apiPost('/admin/auth/totp/disable', {
    username,
    password,
  });
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

