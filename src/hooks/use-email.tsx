import { useState, useCallback } from "react";

const KEY = "dp_user_email";

export function getStoredEmail(): string | null {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
}

export function useEmail() {
  const [email, setEmailState] = useState<string | null>(() => getStoredEmail());

  const setEmail = useCallback((value: string) => {
    const trimmed = value.trim().toLowerCase();
    try { localStorage.setItem(KEY, trimmed); } catch {}
    setEmailState(trimmed || null);
  }, []);

  const clearEmail = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch {}
    setEmailState(null);
  }, []);

  return { email, setEmail, clearEmail };
}
