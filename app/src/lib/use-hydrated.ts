import { useSyncExternalStore } from "react";

const neverChanges = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
}
