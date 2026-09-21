/**
 * Race a promise against a wall-clock timeout.
 * Clears the timer when the promise settles so it does not leak.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {string} [message]
 * @returns {Promise<T>}
 */
export function withTimeout(
  promise,
  timeoutMs,
  message = "Request timed out",
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
