# Spec 4 — Photo Upload (Cloudinary) Design

**Date:** 2026-05-26  
**Branch:** `feat/rooms-service`  
**Status:** approved

---

## Goal

Replace manual URL input on `POST /non-conformities/:id/photos` with real file upload via Cloudinary. Photos are stored in Cloudinary with automatic resize/compression; only the resulting `secure_url` is persisted in the database.

---

## Architecture

Three layers touched:

| Layer | Change |
|---|---|
| `shared/config/env.ts` | Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` to Zod schema |
| `shared/storage/cloudinary.ts` | New utility — configures SDK, exports `uploadPhoto(buffer: Buffer): Promise<string>` |
| Module `non-conformity` | Controller parses multipart; service validates + calls `uploadPhoto`; routes drops JSON body schema |

`non-conformity.repository.ts` is unchanged — still receives `{ url: string }` and persists. No Prisma migration needed (`Photo.url VARCHAR(500)` is sufficient for Cloudinary URLs ~130 chars).

---

## Upload Flow

```
POST /non-conformities/:id/photos (multipart/form-data, field: "file")
  ↓
Controller: request.file() → { buffer, mimetype }
  ↓
Service: validate MIME type + size → uploadPhoto(buffer)
  ↓
shared/storage/cloudinary.ts:
  cloudinary.uploader.upload_stream({
    folder: "home/checkobra",
    transformation: [{ width: 1920, quality: 80, fetch_format: "auto", crop: "limit" }],
  })
  ↓
Cloudinary returns secure_url
  ↓
repo.addPhoto(ncId, { url: secure_url })
  ↓
201 → { id, url, uploadedAt }
```

**`crop: "limit"`** — does not upscale images smaller than 1920px.  
**`fetch_format: "auto"`** — Cloudinary selects WebP/AVIF/JPEG per client, maximizing compression.

---

## Validation

Performed in service before calling Cloudinary:

| Check | Value | Error |
|---|---|---|
| NC exists | `findById(ncId)` | 404 |
| MIME type | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif` | 415 |
| File size | max 10 MB | 413 |
| Cloudinary failure | any SDK error | 502 (generic message, no internal detail) |

---

## Environment Variables

Added to `src/shared/config/env.ts` Zod schema and `.env` / Vercel:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Files Changed

### Created
- `src/shared/storage/cloudinary.ts`

### Modified
- `src/shared/config/env.ts` — 3 new Cloudinary vars
- `src/modules/non-conformity/non-conformity.controller.ts` — `addPhoto` reads multipart via `request.file()`
- `src/modules/non-conformity/non-conformity.service.ts` — calls `uploadPhoto`, handles 415/413/502
- `src/modules/non-conformity/non-conformity.routes.ts` — `POST /:id/photos` has no `body` schema (multipart bypasses Zod body)
- `src/modules/non-conformity/non-conformity.schema.ts` — remove `addPhotoSchema` and `AddPhotoInput`
- `insomnia-collection.json` — "Add Photo" request updated to multipart with `file` field

### Unchanged
- `non-conformity.repository.ts`
- `prisma/schema.prisma`
- No migration needed

---

## `shared/storage/cloudinary.ts` — Implementation Shape

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

---

## Out of Scope (Spec 4)

- Deleting photos from Cloudinary on `DELETE /non-conformities/:id/photos/:photoId` (Cloudinary public_id not stored — Spec 5)
- Image validation beyond MIME type (dimensions, corruption)
- Multiple file upload in a single request
- Signed upload URLs (direct client-to-Cloudinary upload)
