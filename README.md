# Construção Civil API

API RESTful desenvolvida com **Fastify** e **Prisma** para gerenciamento de obras e inspeções. O projeto segue arquitetura hexagonal e utiliza autenticação JWT.

## Stack

- **Runtime**: [Node.js](https://nodejs.org/) (v20.x+)
- **Framework**: [Fastify](https://www.fastify.io/) (v5)
- **ORM**: [Prisma](https://prisma.io/) (v6)
- **Banco de Dados**: PostgreSQL (Neon)
- **Autenticação**: JWT + Bcrypt
- **Validação**: Zod

## Requisitos

- Node.js 20.x
- npm 10.x

## Instalação

1. Clone o repositório:
   ```bash
   git clone <url-do-repositorio>
   cd project-construction-back
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:

   ```bash
   cp .env.example .env
   ```

   Configure as seguintes variáveis:

   ```env
   DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
   JWT_SECRET="secret-jwt-random"
   PORT=3000
   ```

4. Execute as migrações do banco de dados:
   ```bash
   npx prisma migrate dev
   ```

## Execução

### Desenvolvimento

Para iniciar o servidor em modo de desenvolvimento com hot-reload:

```bash
npm run dev
```

A API estará disponível em `http://localhost:3000`.

### Build

Para gerar a versão de produção:

```bash
npm run build
```

### Produção

Para rodar a versão de produção:

```bash
npm run start
```

## Arquitetura

O projeto segue a arquitetura hexagonal com separação clara entre:

- **Domain**: Regras de negócio
- **Application**: Orquestração e fluxos
- **Infra**: Implementações externas (DB, HTTP, Auth)
- **Shared**: Utilitários comuns

### Módulos

- **Auth**: Autenticação e autorização
- **Users**: Gerenciamento de usuários
- **Buildings**: Gerenciamento de prédios
- **Apartments**: Gerenciamento de apartamentos
- **Dependencies**: Dependências por apartamento
- **Inspections**: Planejamento e acompanhamento de inspeções
- **Services**: Serviços associados a inspeções
- **Checklists**: Checklists de inspeção

## Endpoints

### Autenticação

- `POST /auth/login` - Login
- `GET /auth/me` - Usuário logado

### Usuários

- `GET /users` - Listar usuários
- `GET /users/:id` - Obter usuário
- `POST /users` - Criar usuário
- `PATCH /users/:id` - Atualizar usuário
- `DELETE /users/:id` - Remover usuário

### Edifícios

- `GET /buildings` - Listar edifícios
- `GET /buildings/:id` - Obter edifício
- `POST /buildings` - Criar edifício
- `PATCH /buildings/:id` - Atualizar edifício
- `DELETE /buildings/:id` - Remover edifício

### Apartamentos

- `GET /apartments` - Listar apartamentos
- `GET /apartments/:id` - Obter apartamento
- `POST /apartments` - Criar apartamento
- `PATCH /apartments/:id` - Atualizar apartamento
- `DELETE /apartments/:id` - Remover apartamento

### Dependências

- `GET /dependencies` - Listar dependências
- `GET /dependencies/:id` - Obter dependência
- `POST /dependencies` - Criar dependência
- `PATCH /dependencies/:id` - Atualizar dependência
- `DELETE /dependencies/:id` - Remover dependência

### Inspeções

- `GET /inspections` - Listar inspeções
- `GET /inspections/:id` - Obter inspeção
- `POST /inspections` - Criar inspeção
- `PATCH /inspections/:id` - Atualizar inspeção
- `DELETE /inspections/:id` - Remover inspeção

### Serviços

- `GET /services` - Listar serviços
- `GET /services/:id` - Obter serviço
- `POST /services` - Criar serviço
- `PATCH /services/:id` - Atualizar serviço
- `DELETE /services/:id` - Remover serviço

### Checklists

- `GET /checklists` - Listar checklists
- `GET /checklists/:id` - Obter checklist
- `POST /checklists` - Criar checklist
- `PATCH /checklists/:id` - Atualizar checklist
- `DELETE /checklists/:id` - Remover checklist

## Validação de Dados

Todas as requisições de criação e atualização passam por validação via Zod. Os esquemas de validação estão localizados em `src/shared/schemas/`.

## Testes

Para rodar os testes:

```bash
npm run test
```

# Frontend Integration Guide

API backend for project-construction. This README documents how a frontend client connects, authenticates, and consumes endpoints.

> No secrets included. Get `DATABASE_URL`, `JWT_SECRET`, and prod URLs from your team lead or the Vercel project settings.

---

## Stack

- Node.js + TypeScript (ESM)
- Fastify v5
- Prisma v6 + PostgreSQL (Neon)
- JWT auth (`@fastify/jwt` + bcrypt)
- Deploy: Vercel (serverless)

---

## Base URLs

| Environment | URL |
|---|---|
| Local dev | `http://localhost:3000` |
| Production | Configured in the Vercel dashboard (ask team lead) |

> Set the base URL via an env var on the frontend (e.g. `VITE_API_URL` / `NEXT_PUBLIC_API_URL`). Never hardcode.

---

## CORS

- **Development:** `origin: true` — any origin accepted.
- **Production:** `origin: false` — CORS disabled by default. The frontend must be served from the same domain, or CORS needs to be reconfigured server-side.
- **Methods allowed:** `GET, POST, PUT, PATCH, DELETE, OPTIONS`

---

## Authentication

JWT Bearer token. Flow:

1. `POST /auth/login` with credentials → receives `{ token }`.
2. Store the token (memory / `httpOnly` cookie / `localStorage` — pick per security model).
3. Send on every protected request:
   ```
   Authorization: Bearer <token>
   ```

JWT payload:
```ts
{ sub: string,  // user id
  role: string  // ADMIN | MANAGER | INSPECTOR
}
```

---

## Endpoints

### Health

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/health` | — | — | `{ status: "ok" }` |

### Auth — `/auth`

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` | `{ token }` |
| GET | `/auth/me` | Bearer | — | current user payload |

**Login body**
```json
{
  "email": "user@example.com",
  "password": "min 6 chars"
}
```

### Users — `/users`

All routes require `Authorization: Bearer <token>`. Some require a specific role.

| Method | Path | Required role | Body / Params | Notes |
|---|---|---|---|---|
| GET | `/users` | ADMIN, MANAGER | — | List all users |
| GET | `/users/:id` | any authenticated | `id` (number) | Service checks ownership / ADMIN |
| POST | `/users` | ADMIN | `{ name, email, password, roleId }` | Create user |
| PATCH | `/users/:id` | any authenticated | partial of create body | Service checks permission |
| DELETE | `/users/:id` | ADMIN | `id` (number) | Remove user |

**Create user body**
```json
{
  "name": "Min 2 chars",
  "email": "user@example.com",
  "password": "min 6 chars",
  "roleId": 1
}
```

**User response**
```json
{
  "id": 1,
  "name": "...",
  "email": "...",
  "roleId": 1,
  "role": { "id": 1, "name": "ADMIN" },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

## Error Format

All errors return JSON:

```json
{ "message": "Human readable reason" }
```

Validation errors (Zod):
```json
{
  "message": "Validation error",
  "issues": [ /* zod issues */ ]
}
```

| Status | Meaning |
|---|---|
| 400 | Validation / bad request |
| 401 | Missing or invalid token |
| 403 | Authenticated but lacks role |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 500 | Server error |

---

## Frontend Quick Start

```ts
// Example fetch wrapper
const API = import.meta.env.VITE_API_URL; // never hardcode

async function login(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).message);
  return res.json(); // { token }
}

async function me(token: string) {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error((await res.json()).message);
  return res.json();
}
```

---

## Running Locally (backend dev)

```bash
npm install
# Configure .env (see .env.example or ask team lead)
npm run db:migrate   # Applies Prisma migrations
npm run dev          # Starts Fastify with hot reload
```

Required env vars (request values from team lead — never commit them):

```
DATABASE_URL=
JWT_SECRET=
NODE_ENV=development
```

---

## Roles

```
ADMIN     — full access
MANAGER   — can list users, limited admin
INSPECTOR — standard authenticated user
```

`roleId` maps to the `Role` table in the database. Use the role **name** when checking permissions on the frontend (decoded from the JWT payload).

---

## Useful References

- Architecture details: [`CLAUDE.md`](./CLAUDE.md)
- Prisma schema: [`prisma/schema.prisma`](./prisma/schema.prisma)
- Deploy config: [`vercel.json`](./vercel.json)
