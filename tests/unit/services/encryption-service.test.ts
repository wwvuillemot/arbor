// Mock the database helpers BEFORE any imports to prevent database connection attempts
// This must be at the very top of the file for Vitest to hoist it properly
import { vi } from 'vitest';

vi.mock('@tests/helpers/db', () => ({
  getTestDb: vi.fn().mockResolvedValue({}),
  cleanupTestDb: vi.fn().mockResolvedValue(undefined),
  resetTestDb: vi.fn().mockResolvedValue(undefined),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from '@server/services/encryption-service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  // Base64-encoded 32-byte key (256 bits) for AES-256-GCM
  const testMasterKey = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=';

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  describe('encrypt', () => {
    it('should encrypt plaintext and return encrypted value with IV', async () => {
      const plaintext = 'sk-1234567890abcdef';

      const result = await encryptionService.encrypt(plaintext, testMasterKey);

      expect(result).toBeDefined();
      expect(result.encryptedValue).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(typeof result.encryptedValue).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(result.encryptedValue).not.toBe(plaintext);
      expect(result.iv.length).toBeGreaterThan(0);
    });

    it('should generate unique IV for each encryption', async () => {
      const plaintext = 'sk-1234567890abcdef';

      const result1 = await encryptionService.encrypt(plaintext, testMasterKey);
      const result2 = await encryptionService.encrypt(plaintext, testMasterKey);

      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.encryptedValue).not.toBe(result2.encryptedValue);
    });

    it('should encrypt different plaintexts to different ciphertexts', async () => {
      const plaintext1 = 'sk-1234567890abcdef';
      const plaintext2 = 'sk-fedcba0987654321';

      const result1 = await encryptionService.encrypt(plaintext1, testMasterKey);
      const result2 = await encryptionService.encrypt(plaintext2, testMasterKey);

      expect(result1.encryptedValue).not.toBe(result2.encryptedValue);
    });

    it('should throw error for invalid master key', async () => {
      const plaintext = 'sk-1234567890abcdef';
      const invalidKey = 'not-a-valid-base64-key';

      await expect(
        encryptionService.encrypt(plaintext, invalidKey)
      ).rejects.toThrow();
    });

    it('should throw error for empty plaintext', async () => {
      await expect(
        encryptionService.encrypt('', testMasterKey)
      ).rejects.toThrow('Plaintext cannot be empty');
    });

    it('should throw error for empty master key', async () => {
      await expect(
        encryptionService.encrypt('test', '')
      ).rejects.toThrow('Master key cannot be empty');
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted value back to original plaintext', async () => {
      const plaintext = 'sk-1234567890abcdef';

      const encrypted = await encryptionService.encrypt(plaintext, testMasterKey);
      const decrypted = await encryptionService.decrypt(
        encrypted.encryptedValue,
        encrypted.iv,
        testMasterKey
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long plaintexts', async () => {
      const plaintext = 'a'.repeat(1000);

      const encrypted = await encryptionService.encrypt(plaintext, testMasterKey);
      const decrypted = await encryptionService.decrypt(
        encrypted.encryptedValue,
        encrypted.iv,
        testMasterKey
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters and unicode', async () => {
      const plaintext = '🔐 Secret: こんにちは世界! @#$%^&*()';

      const encrypted = await encryptionService.encrypt(plaintext, testMasterKey);
      const decrypted = await encryptionService.decrypt(
        encrypted.encryptedValue,
        encrypted.iv,
        testMasterKey
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error with wrong master key', async () => {
      const plaintext = 'sk-1234567890abcdef';
      const wrongKey = 'ZGlmZmVyZW50a2V5MTZieXRlc2RpZmZlcmVudGtleTE2Ynl0ZXM='; // different 32-byte key

      const encrypted = await encryptionService.encrypt(plaintext, testMasterKey);

      await expect(
        encryptionService.decrypt(encrypted.encryptedValue, encrypted.iv, wrongKey)
      ).rejects.toThrow();
    });

    it('should throw error with tampered encrypted value', async () => {
      const plaintext = 'sk-1234567890abcdef';

      const encrypted = await encryptionService.encrypt(plaintext, testMasterKey);
      const tamperedValue = encrypted.encryptedValue.slice(0, -4) + 'XXXX';

      await expect(
        encryptionService.decrypt(tamperedValue, encrypted.iv, testMasterKey)
      ).rejects.toThrow();
    });

    it('should throw error with tampered IV', async () => {
      const plaintext = 'sk-1234567890abcdef';

      const encrypted = await encryptionService.encrypt(plaintext, testMasterKey);
      const tamperedIV = encrypted.iv.slice(0, -4) + 'XXXX';

      await expect(
        encryptionService.decrypt(encrypted.encryptedValue, tamperedIV, testMasterKey)
      ).rejects.toThrow();
    });

    it('should throw error for empty encrypted value', async () => {
      await expect(
        encryptionService.decrypt('', 'someiv', testMasterKey)
      ).rejects.toThrow('Encrypted value cannot be empty');
    });

    it('should throw error for empty IV', async () => {
      await expect(
        encryptionService.decrypt('somevalue', '', testMasterKey)
      ).rejects.toThrow('IV cannot be empty');
    });
  });
});

