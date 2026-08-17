/**
 * Snapshot of the active PIN / session operator for register API calls.
 * @param {{ username?: string, name?: string, role?: string } | null | undefined} operator
 */
export function registerOperatorPayload(operator) {
  if (!operator) return { username: "", name: "", role: "" };
  return {
    username: String(operator.username || "").trim(),
    name: String(operator.name || "").trim(),
    role: String(operator.role || "").trim(),
  };
}
