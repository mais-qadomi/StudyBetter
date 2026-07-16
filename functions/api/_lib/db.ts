import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

export function getSql(databaseUrl: string) {
  if (!_sql) _sql = neon(databaseUrl);
  return _sql;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}
