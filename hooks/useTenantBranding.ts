"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TenantBrand {
  name: string;
  primaryColor: string;
  logoUrl?: string;
}

interface State {
  tenantBrand: TenantBrand | null;
  isLoading: boolean;
  isValid: boolean;
  error: string | null;
}

export function useTenantBranding(code: string) {
  const [state, setState] = useState<State>({
    tenantBrand: null,
    isLoading: false,
    isValid: false,
    error: null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBranding = useCallback(async (tenantCode: string) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setState({ tenantBrand: null, isLoading: true, isValid: false, error: null });
    try {
      const res = await fetch(
        `/api/tenant/branding?code=${encodeURIComponent(tenantCode)}`,
        { signal: abortRef.current.signal }
      );
      if (res.ok) {
        const data: TenantBrand = await res.json();
        setState({ tenantBrand: data, isLoading: false, isValid: true, error: null });
      } else {
        setState({ tenantBrand: null, isLoading: false, isValid: false, error: "Tenant not found" });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState({ tenantBrand: null, isLoading: false, isValid: false, error: "Lookup failed" });
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!code || code.length < 3) {
      // Defer state reset to avoid synchronous setState in effect body
      timerRef.current = setTimeout(() => {
        setState({ tenantBrand: null, isLoading: false, isValid: false, error: null });
      }, 0);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    timerRef.current = setTimeout(() => fetchBranding(code), 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code, fetchBranding]);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ tenantBrand: null, isLoading: false, isValid: false, error: null });
  }, []);

  return { ...state, reset };
}
