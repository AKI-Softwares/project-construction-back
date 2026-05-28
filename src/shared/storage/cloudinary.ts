import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export async function uploadPhoto(buffer: Buffer): Promise<{ secureUrl: string; publicId: string }> {
  if (!buffer.length) throw new Error("Upload buffer is empty.");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "home/checkobra",
        transformation: [{ width: 1920, quality: 80, fetch_format: "auto", crop: "limit" }],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Cloudinary upload failed."));
        resolve({ secureUrl: result.secure_url, publicId: result.public_id });
      },
    );
    stream.on("error", reject);
    stream.end(buffer);
  });
}

export async function deleteCloudinaryPhoto(publicId: string): Promise<void> {
  if (!publicId) throw new Error("publicId is required for deletion.");
  const result = await cloudinary.uploader.destroy(publicId);
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary delete failed: ${result.result}`);
  }
}
