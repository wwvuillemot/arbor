import { describe, it, expect } from "vitest";
import enMessages from "../../src/i18n/messages/en.json";
import jaMessages from "../../src/i18n/messages/ja.json";

type TranslationObject = Record<string, any>;

/**
 * Recursively find all keys in a nested object
 * Returns an array of dot-notation paths (e.g., "settings.theme.label")
 */
function getAllKeys(obj: TranslationObject, prefix = ""): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      // Recursively get keys from nested objects
      keys.push(...getAllKeys(value, fullKey));
    } else {
      // Leaf node (string, number, boolean, array)
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Find keys that exist in source but not in target
 */
function findMissingKeys(
  source: TranslationObject,
  target: TranslationObject,
): string[] {
  const sourceKeys = getAllKeys(source);
  const targetKeys = new Set(getAllKeys(target));

  return sourceKeys.filter((key) => !targetKeys.has(key));
}

/**
 * Find arrays that have different lengths between locales
 * Returns array of { key, enLength, jaLength }
 */
function findMismatchedArrays(
  en: TranslationObject,
  ja: TranslationObject,
): Array<{ key: string; enLength: number; jaLength: number }> {
  const mismatches: Array<{ key: string; enLength: number; jaLength: number }> =
    [];

  function compareArrays(
    enObj: TranslationObject,
    jaObj: TranslationObject,
    prefix = "",
  ) {
    for (const [key, enValue] of Object.entries(enObj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const jaValue = jaObj[key];

      if (Array.isArray(enValue) && Array.isArray(jaValue)) {
        if (enValue.length !== jaValue.length) {
          mismatches.push({
            key: fullKey,
            enLength: enValue.length,
            jaLength: jaValue.length,
          });
        }
      } else if (
        enValue &&
        typeof enValue === "object" &&
        !Array.isArray(enValue) &&
        jaValue &&
        typeof jaValue === "object" &&
        !Array.isArray(jaValue)
      ) {
        compareArrays(enValue, jaValue, fullKey);
      }
    }
  }

  compareArrays(en, ja);
  return mismatches;
}

describe("i18n translations", () => {
  describe("translation key completeness", () => {
    it("should have all English keys in Japanese", () => {
      const missingKeys = findMissingKeys(enMessages, jaMessages);

      if (missingKeys.length > 0) {
        console.error("Missing Japanese translations for:", missingKeys);
      }

      expect(missingKeys).toEqual([]);
    });

    it("should have all Japanese keys in English", () => {
      const missingKeys = findMissingKeys(jaMessages, enMessages);

      if (missingKeys.length > 0) {
        console.error("Missing English translations for:", missingKeys);
      }

      expect(missingKeys).toEqual([]);
    });
  });

  describe("array length consistency", () => {
    it("should have matching array lengths across locales", () => {
      const mismatchedArrays = findMismatchedArrays(enMessages, jaMessages);

      if (mismatchedArrays.length > 0) {
        console.error("Mismatched array lengths:");
        mismatchedArrays.forEach(({ key, enLength, jaLength }) => {
          console.error(
            `  ${key}: English has ${enLength} items, Japanese has ${jaLength} items`,
          );
        });
      }

      expect(mismatchedArrays).toEqual([]);
    });
  });

  describe("translation structure", () => {
    it("should have the same structure in both locales", () => {
      const enKeys = getAllKeys(enMessages).sort();
      const jaKeys = getAllKeys(jaMessages).sort();

      expect(enKeys).toEqual(jaKeys);
    });
  });

  describe("required translation namespaces", () => {
    it("should have settings namespace", () => {
      expect(enMessages.settings).toBeDefined();
      expect(jaMessages.settings).toBeDefined();
    });

    it("should have commands namespace", () => {
      expect(enMessages.commands).toBeDefined();
      expect(jaMessages.commands).toBeDefined();
    });

    it("should have projects namespace", () => {
      expect(enMessages.projects).toBeDefined();
      expect(jaMessages.projects).toBeDefined();
    });

    it("should have about namespace", () => {
      expect(enMessages.about).toBeDefined();
      expect(jaMessages.about).toBeDefined();
    });
  });
});
