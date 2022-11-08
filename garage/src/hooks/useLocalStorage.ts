import { useMemo, useState } from "react";

// From https://usehooks.com/useLocalStorage/
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = (value: T) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
      // Save to local storage
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.log(error);
    }
  };

  return [storedValue, setValue];
};

interface ExpiresAt {
  expiresAt: Date;
}

export const useExpiringLocalStorage = <T extends ExpiresAt>(
  key: string,
  initialValue: T | undefined
) => {
  const [_value, setValue] = useLocalStorage(key, initialValue);

  const value = useMemo(() => {
    if (_value?.expiresAt && new Date(_value.expiresAt) >= new Date()) {
      return _value;
    }
  }, [_value]);

  return [value, setValue];
};
