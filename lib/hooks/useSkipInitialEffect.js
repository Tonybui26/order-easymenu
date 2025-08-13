import { useEffect, useRef } from "react";

export function useSkipInitialEffect(callback, dependencies) {
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    callback();
  }, dependencies);
}
