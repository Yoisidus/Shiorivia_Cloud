"use client";
import { safeCloudCredentials, type CloudCredentials } from "./cloudCredentials";

/** The passphrase and derived CryptoKey are never persisted. AES-GCM uses a fresh IV for each write. */
export type CredentialVaultRecord = { schema: "shiorivia-cloud-byok-v1"; salt: string; iv: string; ciphertext: string };
const ITERATIONS = 310_000;
function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), ch => ch.charCodeAt(0));
}
function randomBytes(count: number): Uint8Array<ArrayBuffer> {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure browser cryptography is unavailable.");
  return crypto.getRandomValues(new Uint8Array(count));
}
export function isCredentialVaultRecord(raw: unknown): raw is CredentialVaultRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  return obj.schema === "shiorivia-cloud-byok-v1"
    && typeof obj.salt === "string" && typeof obj.iv === "string" && typeof obj.ciphertext === "string";
}
async function deriveKey(passphrase: string, salt: string): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) throw new Error("Secure browser cryptography is unavailable.");
  const bytes = new TextEncoder().encode(passphrase);
  const saltBytes = decodeBase64(salt);
  if (saltBytes.length !== 16) throw new Error("Invalid vault salt.");
  const material = await crypto.subtle.importKey("raw", bytes.buffer as ArrayBuffer, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes.buffer as ArrayBuffer, iterations: ITERATIONS, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}
export async function encryptCredentialVault(
  credentials: CloudCredentials, key: CryptoKey, salt: string,
): Promise<CredentialVaultRecord> {
  const iv = randomBytes(12);
  const encoded = new TextEncoder().encode(JSON.stringify(safeCloudCredentials(credentials)));
  const result = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, encoded.buffer as ArrayBuffer);
  return {
    schema: "shiorivia-cloud-byok-v1", salt, iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(result)),
  };
}
export async function createCredentialVault(
  passphrase: string, credentials: CloudCredentials,
): Promise<{ record: CredentialVaultRecord; key: CryptoKey }> {
  if (passphrase.length < 12) throw new Error("Passphrase must have at least 12 characters.");
  const salt = encodeBase64(randomBytes(16));
  const key = await deriveKey(passphrase, salt);
  return { key, record: await encryptCredentialVault(credentials, key, salt) };
}
export async function unlockCredentialVault(
  record: CredentialVaultRecord, passphrase: string,
): Promise<{ credentials: CloudCredentials; key: CryptoKey }> {
  const key = await deriveKey(passphrase, record.salt);
  const iv = decodeBase64(record.iv);
  if (iv.length !== 12) throw new Error("Invalid vault IV.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, decodeBase64(record.ciphertext).buffer as ArrayBuffer,
  );
  const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decrypted));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid decrypted vault data.");
  return { credentials: safeCloudCredentials(data), key };
}
