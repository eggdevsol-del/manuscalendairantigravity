import type { QueryClient } from "@tanstack/react-query";
export function invalidateWorkspace(client: QueryClient) {
  return client.invalidateQueries({ predicate: query => {
    const path = query.queryKey[0];
    return Array.isArray(path) && !["auth", "system", "push"].includes(String(path[0]));
  } });
}
