"use client";

import { useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';

export class ApiError extends Error {
  public statusCode: number;
  public errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}

class ApiClient {
  private baseUrl = '';

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || !data.success) {
      // API may return 'error' or 'message' property
      let errorMessage = (data as any).error || data.message || 'Something went wrong';
      
      // Include validation details if present
      const details = (data as any).details;
      if (details && Array.isArray(details) && details.length > 0) {
        const detailMessages = details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join('; ');
        errorMessage = `${errorMessage}: ${detailMessages}`;
      }
      
      const error = new ApiError(
        errorMessage,
        response.status,
        data.errorCode
      );
      throw error;
    }

    return data.data as T;
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; errorCode?: string }> {
  const response = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();
  return data;
}

// Hook for using API with toast integration
export function useApi() {
  const { addToast } = useToast();

  const apiCall = useCallback(async <T = any>(
    apiFunction: () => Promise<T>,
    options: {
      successMessage?: string;
      showErrorToast?: boolean;
    } = {}
  ): Promise<T> => {
    const { successMessage, showErrorToast = true } = options;

    try {
      const result = await apiFunction();

      if (successMessage) {
        addToast('success', successMessage);
      }

      return result;
    } catch (error) {
      if (error instanceof ApiError && showErrorToast) {
        addToast('error', error.message);
      } else if (showErrorToast) {
        addToast('error', 'Something went wrong. Please try again.');
      }
      throw error;
    }
  }, [addToast]);

  return { apiCall };
}