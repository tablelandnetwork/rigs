import { useCallback, useEffect, useReducer } from "react";
import { copySet } from "~/utils/set";

interface KeyEvent {
  action: "up" | "down";
  key: string;
}

export const useKeysDown = () => {
  const [keysDown, keyPressed] = useReducer(
    (state: Set<string>, { action, key }: KeyEvent) => {
      let result = copySet(state);

      if (action === "down") {
        result.add(key);
      } else {
        if (key === "Meta") result = new Set();
        else result.delete(key);
      }

      return result;
    },
    new Set<string>()
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      keyPressed({ action: "down", key: e.key });
    },
    [keyPressed]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      keyPressed({ action: "up", key: e.key });
    },
    [keyPressed]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  });

  return keysDown;
};
