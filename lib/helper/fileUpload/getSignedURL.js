// Get SignedURL to Upload File to S3 bucket
"use server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import crypto from "crypto";

export async function getSignedURL(type, size, checksum) {
  const generateFileName = (bytes = 32) =>
    crypto.randomBytes(bytes).toString("hex");

  console.log("AWS Access Key:", process.env.AWS_ACCESS_KEY_MC);
  console.log("AWS Secret Key:", process.env.AWS_SECRET_KEY_MC);
  console.log("AWS Region:", process.env.AWS_BUCKET_REGION);

  const s3 = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_MC || "",
      secretAccessKey: process.env.AWS_SECRET_KEY_MC || "",
    },
  });

  const acceptedTypes = [
    "image/png",
    "image/jpeg",
    "image/heic",
    "image/gif",
    "image/webp",
  ];

  const maxFileSize = 1024 * 1024 * 5; // 5MB

  // Use to return the a SignedUrl from AWS S3 for uploading file
  // Ex:the user can use this specific Signed URL to upload file to S3 bucket, we can use this to check login status before they request to upload.

  // Use NextAuth to check for login status
  if (!acceptedTypes.includes(type)) {
    return { failure: "Invalid file type" };
  }
  if (size > maxFileSize) {
    return { failure: "File too large" };
  }

  const putObjectCommand = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: generateFileName(), // File name after upload
    ContentType: type,
    ContentLength: size,
    ChecksumSHA256: checksum, // make sure the file that in the client size is the same file that will be uploaded.
    // Metadata: {
    //   userId: sessionStorage.user.id,
    // },
  });
  const signedURL = await getSignedUrl(s3, putObjectCommand, {
    expiresIn: 300, // In seconds
  });
  return { success: { url: signedURL } };
}
