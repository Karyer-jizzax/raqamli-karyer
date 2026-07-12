// Shared domain enums & types. Mirror the backend; api-client adds generated DTOs.

export const ROLES = ['superadmin', 'department', 'operator'] as const;
export type Role = (typeof ROLES)[number];

export const DIRECTIONS = ['exit', 'enter'] as const;
export type Direction = (typeof DIRECTIONS)[number];

// no_plate = ANPR raqamni o'qiy olmagan — operator qo'lda kiritadi
export const STATUSES = ['confirm', 'flagged', 'inspect', 'no_plate'] as const;
export type StatusKey = (typeof STATUSES)[number];

export const PAYER_TYPES = ['legal', 'indiv', 'yatt'] as const;
export type PayerType = (typeof PAYER_TYPES)[number];

export const LANGS = ['uz-latn', 'uz-cyrl', 'ru'] as const;
export type Lang = (typeof LANGS)[number];

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  quarryId: string | null;
  regionId: string | null;
}
