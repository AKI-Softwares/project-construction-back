# Spec 4 — Photo Upload (Cloudinary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual URL input on `POST /non-conformities/:id/photos` with real file upload via Cloudinary, storing only the returned `secure_url` in the database.

**Architecture:** New shared utility `src/shared/storage/cloudinary.ts` wraps the Cloudinary SDK and exposes `uploadPhoto(buffer: Buffer): Promise<string>`. The non-conformity service validates MIME type, calls `uploadPhoto`, and persists the URL. The controller reads the incoming multipart file and passes the buffer + mimetype to the service. No schema change, no migration.

**Tech Stack:** Fastify v5, `@fastify/multipart` v10 (already registered, 10 MB limit), `cloudinary` SDK v2 (to install), TypeScript ESM (`.js` imports), Zod v4

---

## File Map

### Created
- `src/shared/storage/cloudinary.ts` — SDK configuration + `uploadPhoto` function

### Modified
- `src/shared/config/env.ts` — add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `src/modules/non-conformity/non-conformity.schema.ts` — remove `addPhotoSchema` and `AddPhotoInput`
- `src/modules/non-conformity/non-conformity.repository.ts` — update `addPhoto` signature (`url: string` instead of `data: AddPhotoInput`)
- `src/modules/non-conformity/non-conformity.service.ts` — new `addPhoto` implementation with validation + upload
- `src/modules/non-conformity/non-conformity.controller.ts` — parse multipart file instead of JSON body
- `src/modules/non-conformity/non-conformity.routes.ts` — remove `body` schema from POST route
- `insomnia-collection.json` — update "Add Photo" request to multipart

### Unchanged
- `src/modules/non-conformity/non-conformity.repository.ts` — only signature change, logic same
- `prisma/schema.prisma` — no migration needed
- `src/main/app.ts` — no changes

---

## Task 1: Install Cloudinary SDK + Update Env

**Files:**
- Modify: `package.json` (via npm)
- Modify: `src/shared/config/env.ts`

- [ ] **Step 1: Install cloudinary package**

```bash
npm install cloudinary
```

Expected: `cloudinary` added to `dependencies` in `package.json`.

- [ ] **Step 2: Add Cloudinary env vars to `src/shared/config/env.ts`**

Current file:
```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(8),
  PORT: z.coerce.number().default(3333),
  CORS_ORIGINS: z.string().default(""),
});

export const env = envSchema.parse(process.env);
```

Replace with:
```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(8),
  PORT: z.coerce.number().default(3333),
  CORS_ORIGINS: z.string().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: clean exit, no errors. If Zod throws at startup because env vars are missing in local `.env`, add them first.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/shared/config/env.ts
git commit -m "feat(config): add Cloudinary env vars, install cloudinary SDK"
```

---

## Task 2: Create `shared/storage/cloudinary.ts`

**Files:**
- Create: `src/shared/storage/cloudinary.ts`

- [ ] **Step 1: Create the file**

```ts
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export async function uploadPhoto(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "home/checkobra",
        transformation: [{ width: 1920, quality: 80, fetch_format: "auto", crop: "limit" }],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Cloudinary upload failed."));
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}
```

- `folder: "home/checkobra"` — Cloudinary folder where photos are organized
- `crop: "limit"` — does NOT upscale images smaller than 1920px
- `fetch_format: "auto"` — Cloudinary picks WebP/AVIF/JPEG per client capability

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/shared/storage/cloudinary.ts
git commit -m "feat(storage): add Cloudinary uploadPhoto utility"
```

---

## Task 3: Update Non-Conformity Module

**Files:**
- Modify: `src/modules/non-conformity/non-conformity.schema.ts`
- Modify: `src/modules/non-conformity/non-conformity.repository.ts`
- Modify: `src/modules/non-conformity/non-conformity.service.ts`
- Modify: `src/modules/non-conformity/non-conformity.controller.ts`
- Modify: `src/modules/non-conformity/non-conformity.routes.ts`

- [ ] **Step 1: Update `non-conformity.schema.ts` — remove URL schema**

Replace entire file with:
```ts
import { z } from "zod";

export const ncParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const photoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  photoId: z.coerce.number().int().positive(),
});

export type NcParams = z.infer<typeof ncParamsSchema>;
export type PhotoParams = z.infer<typeof photoParamsSchema>;
```

`addPhotoSchema` and `AddPhotoInput` are removed — multipart files don't go through Zod body validation.

- [ ] **Step 2: Update `non-conformity.repository.ts` — fix `addPhoto` signature**

Replace entire file with:
```ts
import { prisma } from "../../shared/infra/database/prisma.js";

export class NonConformityRepository {
  async findById(id: number) {
    return prisma.nonConformity.findUnique({
      where: { id },
      select: { id: true, visitItemId: true },
    });
  }

  async findPhoto(ncId: number, photoId: number) {
    return prisma.photo.findFirst({
      where: { id: photoId, nonConformityId: ncId },
      select: { id: true },
    });
  }

  async addPhoto(ncId: number, url: string) {
    return prisma.photo.create({
      data: { nonConformityId: ncId, url },
      select: { id: true, url: true, uploadedAt: true },
    });
  }

  async deletePhoto(photoId: number) {
    return prisma.photo.delete({ where: { id: photoId }, select: { id: true } });
  }
}
```

- [ ] **Step 3: Update `non-conformity.service.ts` — add upload logic**

Replace entire file with:
```ts
import { HttpError } from "../../shared/errors/http-error.js";
import { uploadPhoto } from "../../shared/storage/cloudinary.js";
import type { NonConformityRepository } from "./non-conformity.repository.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export class NonConformityService {
  constructor(private repo: NonConformityRepository) {}

  async addPhoto(ncId: number, buffer: Buffer, mimeType: string) {
    const nc = await this.repo.findById(ncId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new HttpError(415, "Unsupported file type. Allowed: JPEG, PNG, WebP, HEIC, HEIF.");
    }
    let url: string;
    try {
      url = await uploadPhoto(buffer);
    } catch {
      throw new HttpError(502, "Photo upload failed. Please try again.");
    }
    return this.repo.addPhoto(ncId, url);
  }

  async deletePhoto(ncId: number, photoId: number) {
    const nc = await this.repo.findById(ncId);
    if (!nc) throw new HttpError(404, "Non-conformity not found.");
    const photo = await this.repo.findPhoto(ncId, photoId);
    if (!photo) throw new HttpError(404, "Photo not found.");
    return this.repo.deletePhoto(photoId);
  }
}
```

- [ ] **Step 4: Update `non-conformity.controller.ts` — parse multipart**

Replace entire file with:
```ts
import { HttpError } from "../../shared/errors/http-error.js";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { NonConformityService } from "./non-conformity.service.js";
import type { NcParams, PhotoParams } from "./non-conformity.schema.js";

export class NonConformityController {
  constructor(private service: NonConformityService) {}

  async addPhoto(
    request: FastifyRequest<{ Params: NcParams }>,
    reply: FastifyReply,
  ) {
    const data = await request.file();
    if (!data) throw new HttpError(400, "No file uploaded.");
    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch {
      throw new HttpError(413, "File too large. Maximum size is 10 MB.");
    }
    const photo = await this.service.addPhoto(request.params.id, buffer, data.mimetype);
    return reply.status(201).send(photo);
  }

  async deletePhoto(
    request: FastifyRequest<{ Params: PhotoParams }>,
    reply: FastifyReply,
  ) {
    await this.service.deletePhoto(request.params.id, request.params.photoId);
    return reply.status(204).send();
  }
}
```

`request.file()` comes from `@fastify/multipart` (already registered globally in `app.ts`). `data.mimetype` is the MIME type declared by the client. `data.toBuffer()` reads the stream into memory; throws if file exceeds the 10 MB plugin limit.

- [ ] **Step 5: Update `non-conformity.routes.ts` — remove body schema**

Replace entire file with:
```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { NonConformityRepository } from "./non-conformity.repository.js";
import { NonConformityService } from "./non-conformity.service.js";
import { NonConformityController } from "./non-conformity.controller.js";
import { ncParamsSchema, photoParamsSchema } from "./non-conformity.schema.js";
import { checkPermission } from "../../shared/rbac/check-permission.js";

export const nonConformityRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = new NonConformityRepository();
  const service = new NonConformityService(repo);
  const controller = new NonConformityController(service);

  app.post(
    "/:id/photos",
    {
      schema: { params: ncParamsSchema },
      preHandler: [app.authenticate, checkPermission("photos:create")],
    },
    controller.addPhoto.bind(controller),
  );

  app.delete(
    "/:id/photos/:photoId",
    {
      schema: { params: photoParamsSchema },
      preHandler: [app.authenticate, checkPermission("photos:delete")],
    },
    controller.deletePhoto.bind(controller),
  );
};
```

`body: addPhotoSchema` removed from POST route — multipart requests bypass Zod body validation.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run build
```

Expected: clean exit, zero errors.

- [ ] **Step 7: Manual smoke test**

Start the server:
```bash
npm run dev
```

Test with a real JPEG file via Insomnia or curl (use your auth token):

```bash
curl -X POST http://localhost:3333/non-conformities/1/photos \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/test.jpg"
```

Expected: `201 { "id": N, "url": "https://res.cloudinary.com/...", "uploadedAt": "..." }`.  
Confirm the URL is accessible in a browser and the image appears correctly resized.

Test error cases:
- Send no file → `400 No file uploaded.`
- Send a `.txt` file with `Content-Type: text/plain` → `415 Unsupported file type.`
- Send to a non-existent NC id → `404 Non-conformity not found.`

- [ ] **Step 8: Commit**

```bash
git add src/modules/non-conformity/
git commit -m "feat(non-conformity): replace URL input with Cloudinary multipart upload"
```

---

## Task 4: Update Insomnia Collection

**Files:**
- Modify: `insomnia-collection.json`

- [ ] **Step 1: Read current "Add Photo" request structure**

Open `insomnia-collection.json` and find the request with id `req_nc_photo_add` (or name "Add Photo" in the Non-Conformities folder). It currently has a JSON body `{"url":"https://example.com/photo.jpg"}`.

- [ ] **Step 2: Replace JSON body with multipart**

Update the request body to multipart format. In Insomnia v4 collection JSON the body changes from:

```json
{
  "body": {
    "mimeType": "application/json",
    "text": "{\"url\":\"https://example.com/photo.jpg\"}"
  }
}
```

To:
```json
{
  "body": {
    "mimeType": "multipart/form-data",
    "params": [
      {
        "id": "pair_photo_file",
        "name": "file",
        "value": "",
        "description": "Photo file (JPEG, PNG, WebP, HEIC, HEIF — max 10 MB)",
        "type": "file",
        "enabled": true
      }
    ]
  }
}
```

Read the actual file structure before editing to confirm the exact field names used in the existing collection format. Match the existing `id` prefix pattern for `pair_*` IDs.

- [ ] **Step 3: Commit**

```bash
git add insomnia-collection.json
git commit -m "chore(insomnia): update Add Photo request to multipart file upload"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Install `cloudinary` SDK | Task 1 |
| Add 3 Cloudinary env vars to Zod schema | Task 1 |
| Create `shared/storage/cloudinary.ts` with `uploadPhoto(buffer)` | Task 2 |
| Folder `home/checkobra`, transform: width 1920, quality 80, format auto, crop limit | Task 2 |
| Remove `addPhotoSchema` / `AddPhotoInput` from schema | Task 3 Step 1 |
| `addPhoto(ncId, url)` in repository | Task 3 Step 2 |
| MIME validation (415) + Cloudinary error (502) in service | Task 3 Step 3 |
| Controller reads multipart, handles no-file (400) and too-large (413) | Task 3 Step 4 |
| Routes: no `body` schema on POST /photos | Task 3 Step 5 |
| Insomnia "Add Photo" → multipart | Task 4 |
