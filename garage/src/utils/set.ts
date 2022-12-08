export const firstSetValue = <T,>(s: Set<T>) => {
  if (s.size) return s.values().next().value;
};

export const copySet = <T,>(s: Set<T>): Set<T> => {
  return new Set(Array.from(s));
};

export const toggleInSet = <T,>(s: Set<T>, v: T) => {
  if (s.has(v)) {
    s.delete(v);
  } else {
    s.add(v);
  }

  return s;
};

