export const PERMISSIONS = [
  { action: "users:read",          resource: "users",          operation: "read"   },
  { action: "users:create",        resource: "users",          operation: "create" },
  { action: "users:update",        resource: "users",          operation: "update" },
  { action: "users:delete",        resource: "users",          operation: "delete" },

  { action: "roles:read",          resource: "roles",          operation: "read"   },
  { action: "roles:create",        resource: "roles",          operation: "create" },
  { action: "roles:update",        resource: "roles",          operation: "update" },
  { action: "roles:delete",        resource: "roles",          operation: "delete" },

  { action: "permissions:read",    resource: "permissions",    operation: "read"   },

  { action: "buildings:read",      resource: "buildings",      operation: "read"   },
  { action: "buildings:create",    resource: "buildings",      operation: "create" },
  { action: "buildings:update",    resource: "buildings",      operation: "update" },
  { action: "buildings:delete",    resource: "buildings",      operation: "delete" },

  { action: "apartments:read",     resource: "apartments",     operation: "read"   },
  { action: "apartments:create",   resource: "apartments",     operation: "create" },
  { action: "apartments:update",   resource: "apartments",     operation: "update" },
  { action: "apartments:delete",   resource: "apartments",     operation: "delete" },

  { action: "dependencies:read",   resource: "dependencies",   operation: "read"   },
  { action: "dependencies:create", resource: "dependencies",   operation: "create" },
  { action: "dependencies:update", resource: "dependencies",   operation: "update" },
  { action: "dependencies:delete", resource: "dependencies",   operation: "delete" },

  { action: "services:read",       resource: "services",       operation: "read"   },
  { action: "services:create",     resource: "services",       operation: "create" },
  { action: "services:update",     resource: "services",       operation: "update" },
  { action: "services:delete",     resource: "services",       operation: "delete" },

  { action: "checklists:read",     resource: "checklists",     operation: "read"   },
  { action: "checklists:create",   resource: "checklists",     operation: "create" },
  { action: "checklists:update",   resource: "checklists",     operation: "update" },
  { action: "checklists:delete",   resource: "checklists",     operation: "delete" },
  { action: "checklists:sign",     resource: "checklists",     operation: "sign"   },

  { action: "inspections:read",    resource: "inspections",    operation: "read"   },
  { action: "inspections:create",  resource: "inspections",    operation: "create" },
  { action: "inspections:update",  resource: "inspections",    operation: "update" },
  { action: "inspections:delete",  resource: "inspections",    operation: "delete" },
] as const;

export type PermissionAction = (typeof PERMISSIONS)[number]["action"];
