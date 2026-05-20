/**
 * Roles do sistema — devem bater com os registros da tabela Role no banco.
 * Usar sempre estas constantes no código, nunca strings literais.
 */
export const Role = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  INSPECTOR: "INSPECTOR",
} as const;

export type RoleName = (typeof Role)[keyof typeof Role];
