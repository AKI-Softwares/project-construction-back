# Spec 5 — Cloudinary Cleanup + MIME Sniffing Design

**Date:** 2026-05-26
**Branch:** `feat/upload-photos`
**Status:** approved

---

## Goal

Two fixes to the photo upload flow introduced in Spec 4:

1. **Cloudinary cleanup** — save `public_id` on upload and call `cloudinary.uploader.destroy` when a photo is deleted, so files don't accumulate as orphans in paid Cloudinary storage.
2. **MIME sniffing** — replace client-declared `Content-Type` validation with real magic-byte sniffing via `file-type`, preventing clients from bypassing the MIME check by lying about their content type.

---

## Architecture

Two independent concerns, touched in different layers:

| Concern | Layers |
|---|---|
| Cloudinary cleanup | Schema + migration, `shared/storage/cloudinary.ts`, repository, service |
| MIME sniffing | `package.json` (`file-type`), service |

No route, controller, or schema (Zod) changes needed.

---

## Delete Failure Behaviour

If `cloudinary.uploader.destroy` fails (timeout, 5xx), the delete request returns `502` and the photo remains in the database and in Cloudinary. The user retries. No silent orphaning.

`"not found"` from Cloudinary is treated as success — if the file is already gone, the goal is achieved.

---

## Section 1: Schema + Migration

Add `publicId` to the `Photo` model:

```prisma
model Photo {
  id              Int           @id @default(autoincrement())
  nonConformityId Int           @map("non_conformity_id")
  url             String        @db.VarChar(500)
  publicId        String        @map("public_id") @db.VarChar(200)
  uploadedAt      DateTime      @default(now()) @map("uploaded_at") @db.Timestamptz
  nonConformity   NonConformity @relation(fields: [nonConformityId], references: [id], onDelete: Cascade)

  @@index([nonConformityId])
  @@map("Photo")
}
```

Migration: `ALTER TABLE "Photo" ADD COLUMN "public_id" VARCHAR(200) NOT NULL`.

Column is `NOT NULL` — every photo uploaded from Spec 4 onwards has a `public_id`. Assumes a clean dev database with no legacy rows.

---

## Section 2: `shared/storage/cloudinary.ts`

### `uploadPhoto` — new return type

```ts
export async function uploadPhoto(buffer: Buffer): Promise<{ secureUrl: string; publicId: string }>
```

Callback resolves with `{ secureUrl: result.secure_url, publicId: result.public_id }` instead of just `result.secure_url`.

### New function: `deleteCloudinaryPhoto`

```ts
export async function deleteCloudinaryPhoto(publicId: string): Promise<void> {
  const result = await cloudinary.uploader.destroy(publicId);
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary delete failed: ${result.result}`);
  }
}
```

---

## Section 3: Repository

### `addPhoto` — accepts `publicId`

```ts
async addPhoto(ncId: number, url: string, publicId: string) {
  return prisma.photo.create({
    data: { nonConformityId: ncId, url, publicId },
    select: { id: true, url: true, uploadedAt: true },
  });
}
```

### `findPhoto` — selects `publicId`

```ts
select: { id: true, publicId: true }
```

---

## Section 4: Service

### MIME sniffing (replaces client-declared check)

```ts
import { fileTypeFromBuffer } from "file-type";

const detected = await fileTypeFromBuffer(buffer);
if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
  throw new HttpError(415, "Unsupported file type. Allowed: JPEG, PNG, WebP, HEIC, HEIF.");
}
```

The `mimeType: string` parameter is removed from `addPhoto` — no longer needed.

### `addPhoto` — destructures new `uploadPhoto` return

```ts
const { secureUrl, publicId } = await uploadPhoto(buffer);
return this.repo.addPhoto(ncId, secureUrl, publicId);
```

### `deletePhoto` — calls Cloudinary before DB delete

```ts
async deletePhoto(ncId: number, photoId: number) {
  const nc = await this.repo.findById(ncId);
  if (!nc) throw new HttpError(404, "Non-conformity not found.");
  const photo = await this.repo.findPhoto(ncId, photoId);
  if (!photo) throw new HttpError(404, "Photo not found.");
  try {
    await deleteCloudinaryPhoto(photo.publicId);
  } catch {
    throw new HttpError(502, "Failed to delete photo from storage. Please try again.");
  }
  return this.repo.deletePhoto(photoId);
}
```

### `addPhoto` signature

```ts
async addPhoto(ncId: number, buffer: Buffer)
```

`mimeType` parameter removed — sniffed internally.

---

## Section 5: Controller

Remove `data.mimetype` from the `addPhoto` service call:

```ts
const photo = await this.service.addPhoto(request.params.id, buffer);
```

---

## Files Changed

### Modified
- `prisma/schema.prisma` — add `publicId` to Photo
- `prisma/migrations/...` — new migration
- `src/shared/storage/cloudinary.ts` — new return type + `deleteCloudinaryPhoto`
- `src/modules/non-conformity/non-conformity.repository.ts` — `addPhoto` signature, `findPhoto` select
- `src/modules/non-conformity/non-conformity.service.ts` — MIME sniffing, new `uploadPhoto` return, `deletePhoto` Cloudinary call, remove `mimeType` param
- `src/modules/non-conformity/non-conformity.controller.ts` — remove `data.mimetype` from service call

### New dependency
- `file-type` (ESM-native, no native bindings)

### Unchanged
- `non-conformity.schema.ts`
- `non-conformity.routes.ts`
- `src/main/app.ts`
- `prisma/schema.prisma` (all other models)

---

## Out of Scope (Spec 5)

- Cloudinary folder per environment (`CLOUDINARY_FOLDER` env var) — future
- Lazy Cloudinary SDK initialization — future
- Bulk photo delete when NonConformity is cascade-deleted (Cloudinary files would be orphaned in that path)
