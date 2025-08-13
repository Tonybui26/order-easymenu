// Delete file from S3
"use server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function deleteFileFromS3(fileUrl) {
  const s3 = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_MC,
      secretAccessKey: process.env.AWS_SECRET_KEY_MC,
    },
  });

  const fileKey = fileUrl.split("/").pop();
  const deleteObjectCommand = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileKey,
  });

  try {
    await s3.send(deleteObjectCommand);
    return { success: "File deleted" };
  } catch (error) {
    console.log("Error deleting file:", error);
    return { failure: "Error deleting file" };
  }
}
