export default async function uploadToS3BySignedUrl({ file, signedUrl }) {
  const response = await fetch(signedUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });
  if (!response.ok) {
    throw new Error(`Fail Upload to S3 bucket`);
  }
  return signedUrl.split("?")[0];
}
