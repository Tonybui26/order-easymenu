// Function to return Hash Hex from a File and turn it into a string for Checksum
export default async function computeSHA256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
  return hashHex;
}
