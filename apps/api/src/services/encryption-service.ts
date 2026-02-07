import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * EncryptionService provides AES-256-GCM encryption/decryption for sensitive data
 * Uses authenticated encryption to ensure data integrity and confidentiality
 */
export class EncryptionService {
  private readonly algorithm = "aes-256-gcm";
  private readonly ivLength = 12; // 96 bits recommended for GCM
  private readonly authTagLength = 16; // 128 bits

  /**
   * Encrypt plaintext using AES-256-GCM
   * @param plaintext - The text to encrypt
   * @param masterKey - Base64-encoded 32-byte master key
   * @returns Object containing encrypted value (base64) and IV (base64)
   */
  async encrypt(
    plaintext: string,
    masterKey: string,
  ): Promise<{ encryptedValue: string; iv: string }> {
    // Validation
    if (!plaintext || plaintext.length === 0) {
      throw new Error("Plaintext cannot be empty");
    }
    if (!masterKey || masterKey.length === 0) {
      throw new Error("Master key cannot be empty");
    }

    try {
      // Decode the base64 master key
      const keyBuffer = Buffer.from(masterKey, "base64");

      // Validate key length (must be 32 bytes for AES-256)
      if (keyBuffer.length !== 32) {
        throw new Error("Master key must be 32 bytes (256 bits)");
      }

      // Generate random IV (initialization vector)
      const iv = randomBytes(this.ivLength);

      // Create cipher
      const cipher = createCipheriv(this.algorithm, keyBuffer, iv, {
        authTagLength: this.authTagLength,
      });

      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, "utf8", "base64");
      encrypted += cipher.final("base64");

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      // Combine encrypted data and auth tag
      const encryptedWithTag = Buffer.concat([
        Buffer.from(encrypted, "base64"),
        authTag,
      ]);

      return {
        encryptedValue: encryptedWithTag.toString("base64"),
        iv: iv.toString("base64"),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Encryption failed: ${error.message}`);
      }
      throw new Error("Encryption failed: Unknown error");
    }
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   * @param encryptedValue - Base64-encoded encrypted data with auth tag
   * @param iv - Base64-encoded initialization vector
   * @param masterKey - Base64-encoded 32-byte master key
   * @returns Decrypted plaintext
   */
  async decrypt(
    encryptedValue: string,
    iv: string,
    masterKey: string,
  ): Promise<string> {
    // Validation
    if (!encryptedValue || encryptedValue.length === 0) {
      throw new Error("Encrypted value cannot be empty");
    }
    if (!iv || iv.length === 0) {
      throw new Error("IV cannot be empty");
    }
    if (!masterKey || masterKey.length === 0) {
      throw new Error("Master key cannot be empty");
    }

    try {
      // Decode inputs
      const keyBuffer = Buffer.from(masterKey, "base64");
      const ivBuffer = Buffer.from(iv, "base64");
      const encryptedBuffer = Buffer.from(encryptedValue, "base64");

      // Validate key length
      if (keyBuffer.length !== 32) {
        throw new Error("Master key must be 32 bytes (256 bits)");
      }

      // Split encrypted data and auth tag
      const authTag = encryptedBuffer.slice(-this.authTagLength);
      const encrypted = encryptedBuffer.slice(0, -this.authTagLength);

      // Create decipher
      const decipher = createDecipheriv(this.algorithm, keyBuffer, ivBuffer, {
        authTagLength: this.authTagLength,
      });

      // Set the auth tag
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, undefined, "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      if (error instanceof Error) {
        // Authentication failures or tampering will throw here
        if (
          error.message.includes(
            "Unsupported state or unable to authenticate data",
          )
        ) {
          throw new Error(
            "Decryption failed: Invalid key or data has been tampered with",
          );
        }
        throw new Error(`Decryption failed: ${error.message}`);
      }
      throw new Error("Decryption failed: Unknown error");
    }
  }
}
