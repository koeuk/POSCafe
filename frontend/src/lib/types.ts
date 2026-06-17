// Shared domain types, mirroring the backend contract.

export enum Role {
  ADMIN = "admin",
  CASHIER = "cashier",
}

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
}

// Response shape from POST /auth/login and /auth/register.
export interface AuthResponse {
  accessToken: string;
  user: User;
}

// GET /auth/me returns the JWT payload (no name).
export interface AuthUser {
  id: number;
  username: string;
  role: Role;
}
