import { useState, useEffect } from "react";

// Utility functions for cookies
const setCookie = (name: string, value: string, days: number): void => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; expires=${expires}; path=/`;
};

const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2)
    return decodeURIComponent(parts.pop()!.split(";").shift()!);
  return null;
};

export const usePersistentState = <T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const isLocalStorageAvailable = (() => {
    try {
      localStorage.setItem("test", "test");
      localStorage.removeItem("test");
      return true;
    } catch (e) {
      return false;
    }
  })();

  const getInitialValue = (): T => {
    if (isLocalStorageAvailable) {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } else {
      const storedValue = getCookie(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    }
  };

  const [value, setValue] = useState<T>(getInitialValue);

  useEffect(() => {
    if (isLocalStorageAvailable) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      setCookie(key, JSON.stringify(value), 365); // Setting cookie to expire in 365 days
    }
  }, [key, value, isLocalStorageAvailable]);

  return [value, setValue];
};
