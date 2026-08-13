const OPERATOR_KEY = "om-active-operator";
const LOCKED_KEY = "om-terminal-locked";

export function readActiveOperator() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OPERATOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.username) return null;
    return {
      username: parsed.username,
      name: parsed.name || parsed.username,
      role: parsed.role || "",
    };
  } catch {
    return null;
  }
}

export function writeActiveOperator(operator) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    OPERATOR_KEY,
    JSON.stringify({
      username: operator.username,
      name: operator.name || operator.username,
      role: operator.role || "",
    }),
  );
  sessionStorage.removeItem(LOCKED_KEY);
}

export function clearActiveOperator({ locked = false } = {}) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(OPERATOR_KEY);
  if (locked) sessionStorage.setItem(LOCKED_KEY, "1");
  else sessionStorage.removeItem(LOCKED_KEY);
}

export function isTerminalLocked() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(LOCKED_KEY) === "1";
}

export function operatorFromSessionUser(user) {
  if (!user?.username) return null;
  return {
    username: user.username,
    name: user.name || user.username,
    role: user.role || "",
  };
}
