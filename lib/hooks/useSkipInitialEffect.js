import { useEffect, useRef } from "react";

export function useSkipInitialEffect(callback, dependencies) {
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Execute the callback and store any cleanup function it returns
    const cleanup = callback();

    // Return the cleanup function to run on unmount or dependency change
    return cleanup;
  }, dependencies);
}
