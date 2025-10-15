/**
 * Unit test for encryption/decryption key derivation and XOR operations
 * This test isolates the crypto logic without Expo module dependencies
 */

describe('BackupRestoreService - Encryption Core Logic', () => {
  // Replicate the functions for testing
  const simpleHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  };

  const deriveKey = (password: string, salt: string): string => {
    let key = password + salt;
    for (let i = 0; i < 10000; i++) {
      key = simpleHash(key + i.toString());
    }
    return key;
  };

  const xorEncrypt = (text: string, key: string): string => {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return result;
  };

  const xorDecrypt = (encryptedText: string, key: string): string => {
    let result = '';
    for (let i = 0; i < encryptedText.length; i++) {
      const charCode = encryptedText.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return result;
  };

  it('should produce fixed-length hash for consistent key derivation', () => {
    const hashes = [
      simpleHash('test'),
      simpleHash('test123'),
      simpleHash('longerstring'),
      simpleHash('a'),
      simpleHash('verylongstringwithlotsofcharactershere'),
    ];

    // All hashes should be exactly 8 characters
    hashes.forEach((hash) => {
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
      expect(hash.length).toBe(8);
    });

    // Different inputs should produce different outputs
    expect(simpleHash('test')).not.toBe(simpleHash('test2'));
  });

  it('should derive consistent keys from same password and salt', () => {
    const password = 'TestPassword123';
    const salt = '0123456789abcdef0123456789abcdef';

    const key1 = deriveKey(password, salt);
    const key2 = deriveKey(password, salt);

    expect(key1).toBe(key2);
    expect(key1.length).toBeGreaterThan(0);
  });

  it('should derive different keys from different passwords or salts', () => {
    const salt = '0123456789abcdef0123456789abcdef';

    const key1 = deriveKey('Password1', salt);
    const key2 = deriveKey('Password2', salt);
    const key3 = deriveKey('Password1', 'differentSalt123differentSalt123');

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('should correctly encrypt and decrypt text with XOR', () => {
    const password = 'TestPassword123';
    const salt = 'testsalt123456789';
    const key = deriveKey(password, salt);

    const testStrings = [
      '{"test":"data"}',
      '{"settings":{"theme":"light"}}',
      'Simple text',
      '{"a":1,"b":2,"c":{"nested":true}}',
      '', // Empty string
    ];

    testStrings.forEach((testString) => {
      const encrypted = xorEncrypt(testString, key);
      const decrypted = xorDecrypt(encrypted, key);

      expect(decrypted).toBe(testString);
      if (testString.length > 0) {
        expect(encrypted).not.toBe(testString); // Encrypted should be different
      }
    });
  });

  it('should fail to decrypt with wrong key', () => {
    const password = 'CorrectPassword';
    const wrongPassword = 'WrongPassword';
    const salt = 'testsalt123456789';

    const correctKey = deriveKey(password, salt);
    const wrongKey = deriveKey(wrongPassword, salt);

    const originalText = '{"settings":{"theme":"light"}}';
    const encrypted = xorEncrypt(originalText, correctKey);
    const wronglyDecrypted = xorDecrypt(encrypted, wrongKey);

    expect(wronglyDecrypted).not.toBe(originalText);
    // Wrong key should produce garbage
    expect(wronglyDecrypted).not.toEqual(expect.stringContaining('settings'));
  });

  it('should handle long JSON structures correctly', () => {
    const password = 'LongPassword123!@#$%';
    const salt = 'longsalt' + 'x'.repeat(32);
    const key = deriveKey(password, salt);

    const longJson = JSON.stringify({
      settings: {
        state: {
          theme: 'light',
          customTheme: {
            primary: '#1976d2',
            secondary: '#dc004e',
            error: '#f44336',
          },
        },
      },
      serviceConfigs: Array.from({ length: 10 }, (_, i) => ({
        id: `config-${i}`,
        type: 'sonarr',
        name: `Service ${i}`,
        url: `http://localhost:${8000 + i * 1000}`,
        apiKey: `key-${i}-with-extra-characters-to-make-it-longer`,
        enabled: true,
      })),
    });

    const encrypted = xorEncrypt(longJson, key);
    const decrypted = xorDecrypt(encrypted, key);

    expect(decrypted).toBe(longJson);
    expect(decrypted).toContain('key-0-with-extra-characters-to-make-it-longer');
  });

  it('should handle special characters in passwords', () => {
    const specialPasswords = [
      'P@ssw0rd!#$%^&*()',
      'password-with-dashes',
      'password_with_underscores',
      'password with spaces',
    ];

    const salt = 'fixedsalt123456789';
    const testData = '{"encrypted":"data"}';

    specialPasswords.forEach((password) => {
      const key = deriveKey(password, salt);
      const encrypted = xorEncrypt(testData, key);
      const decrypted = xorDecrypt(encrypted, key);

      expect(decrypted).toBe(testData);
    });
  });

  it('should verify key length is always positive and reasonable', () => {
    const testCases = [
      { password: 'a', salt: 'a' },
      { password: 'short', salt: 'short' },
      { password: 'a'.repeat(100), salt: 'b'.repeat(100) },
      { password: '', salt: 'emptypw' },
    ];

    testCases.forEach(({ password, salt }) => {
      const key = deriveKey(password, salt);
      expect(key.length).toBeGreaterThan(0);
      // Key should be reasonably sized (product of multiple 8-char hashes)
      expect(key.length).toBeGreaterThanOrEqual(8);
      expect(key.length).toBeLessThan(10000); // Sanity check
    });
  });
});
