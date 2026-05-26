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
