import type { I18nConfig } from '@/config/i18n'
import type { LocaleJson } from '@/utils/locale'
import { describe, expect, it, vi } from 'vitest'
import { findMissingKeys, mergeMissingTranslations, normalizeLocales, resolveContextLocales, shapeMatches } from '@/utils/locale'

vi.mock('@/utils/general', () => ({
  handleCliError: vi.fn((message: string) => {
    throw new Error(message)
  }),
}))

describe('locale utils', () => {
  describe('shapeMatches', () => {
    it('should return true for objects with the same shape', () => {
      const obj1 = { a: 1, b: { c: 2 } }
      const obj2 = { a: 'test', b: { c: 'nested' } }
      expect(shapeMatches(obj1, obj2)).toBe(true)
    })

    it('should return false for objects with different keys', () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { a: 1, c: 2 }
      expect(shapeMatches(obj1, obj2)).toBe(false)
    })

    it('should return false for objects with different number of keys', () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { a: 1 }
      expect(shapeMatches(obj1, obj2)).toBe(false)
    })

    it('should return false if one object has a nested object and the other does not at the same key', () => {
      const obj1 = { a: 1, b: { c: 2 } }
      const obj2 = { a: 1, b: 2 }
      expect(shapeMatches(obj1, obj2)).toBe(false)
    })

    it('should return false if shapes of nested objects do not match', () => {
      const obj1 = { a: 1, b: { c: 2 } }
      const obj2 = { a: 1, b: { d: 2 } }
      expect(shapeMatches(obj1, obj2)).toBe(false)
    })

    it('should return false if one input is not an object', () => {
      const obj1 = { a: 1 }
      expect(shapeMatches(obj1, null)).toBe(false)
      expect(shapeMatches(null, obj1)).toBe(false)
      expect(shapeMatches(obj1, 123)).toBe(false)
      expect(shapeMatches(123, obj1)).toBe(false)
    })

    it('should return false for two non-object inputs', () => {
      expect(shapeMatches(null, null)).toBe(false)
      expect(shapeMatches(123, 'abc')).toBe(false)
    })

    it('should return true for two empty objects', () => {
      expect(shapeMatches({}, {})).toBe(true)
    })
  })

  describe('normalizeLocales', () => {
    const mockI18nConfig: I18nConfig = {
      locales: ['en-US', 'es-ES', 'fr-FR', 'ja-JP'],
      defaultLocale: 'en-US',
    }

    it('should normalize short locale codes', () => {
      expect(normalizeLocales(['en', 'es'], mockI18nConfig)).toEqual(['en-US', 'es-ES'])
    })

    it('should handle "all" keyword', () => {
      expect(normalizeLocales(['all'], mockI18nConfig)).toEqual(mockI18nConfig.locales)
    })

    it('should handle "def" keyword', () => {
      expect(normalizeLocales(['def'], mockI18nConfig)).toEqual([mockI18nConfig.defaultLocale])
    })

    it('should keep full locale codes if they exist in config', () => {
      expect(normalizeLocales(['fr-FR', 'ja-JP'], mockI18nConfig)).toEqual(['fr-FR', 'ja-JP'])
    })

    it('should handle a mix of valid inputs', () => {
      expect(normalizeLocales(['es', 'all', 'def', 'ja-JP'], mockI18nConfig)).toEqual([
        'es-ES',
        ...mockI18nConfig.locales,
        'en-US',
        'ja-JP',
      ])
    })

    it('should throw error for invalid short locale codes', () => {
      expect(() => normalizeLocales(['xx'], mockI18nConfig)).toThrow('Invalid locale: xx')
    })

    it('should throw error for invalid full locale codes not in config', () => {
      expect(() => normalizeLocales(['en-GB'], mockI18nConfig)).toThrow('Invalid locale: en-GB')
    })

    it('should return an empty array for an empty input array', () => {
      expect(normalizeLocales([], mockI18nConfig)).toEqual([])
    })

    it('should treat empty string as "all" and expand to all locales', () => {
      expect(normalizeLocales([''], mockI18nConfig)).toEqual(mockI18nConfig.locales)
    })

    it('should handle multiple empty strings, expanding for each', () => {
      expect(normalizeLocales(['', 'es', ''], mockI18nConfig)).toEqual([
        ...mockI18nConfig.locales,
        'es-ES',
        ...mockI18nConfig.locales,
      ])
    })
  })

  describe('findMissingKeys', () => {
    it('should return an empty object if no keys are missing', () => {
      const defaultObj: LocaleJson = { a: '1', b: { c: '2' } }
      const localeObj: LocaleJson = { a: 'uno', b: { c: 'dos' } }
      expect(findMissingKeys(defaultObj, localeObj)).toEqual({})
    })

    it('should find missing keys at the root level', () => {
      const defaultObj: LocaleJson = { a: '1', b: '2' }
      const localeObj: LocaleJson = { a: 'uno' }
      expect(findMissingKeys(defaultObj, localeObj)).toEqual({ b: '2' })
    })

    it('should find missing keys in nested objects', () => {
      const defaultObj: LocaleJson = { a: '1', b: { c: '2', d: '3' } }
      const localeObj: LocaleJson = { a: 'uno', b: { c: 'dos' } }
      expect(findMissingKeys(defaultObj, localeObj)).toEqual({ 'b.d': '3' })
    })

    it('should find entire missing nested objects', () => {
      const defaultObj: LocaleJson = { a: '1', b: { c: '2', d: '3' } }
      const localeObj: LocaleJson = { a: 'uno' }
      expect(findMissingKeys(defaultObj, localeObj)).toEqual({ 'b.c': '2', 'b.d': '3' })
    })

    it('should return all keys from default if localeObj is empty', () => {
      const defaultObj: LocaleJson = { a: '1', b: { c: '2' } }
      const localeObj: LocaleJson = {}
      expect(findMissingKeys(defaultObj, localeObj)).toEqual({ 'a': '1', 'b.c': '2' })
    })

    it('should return an empty object if defaultObj is empty', () => {
      const defaultObj: LocaleJson = {}
      const localeObj: LocaleJson = { a: 'uno' }
      expect(findMissingKeys(defaultObj, localeObj)).toEqual({})
    })

    it('should return an empty object if both objects are empty', () => {
      const defaultObj: LocaleJson = {}
      const localeObj: LocaleJson = {}
      expect(findMissingKeys(defaultObj, localeObj)).toEqual({})
    })

    it('should ignore keys present in localeObj but not in defaultObj', () => {
      const defaultObj: LocaleJson = { a: '1' }
      const localeObj: LocaleJson = { a: 'uno', b: 'dos' }
      expect(findMissingKeys(defaultObj, localeObj)).toEqual({})
    })

    it('should handle deeply nested missing keys', () => {
      const defaultObj: LocaleJson = { a: { b: { c: { d: 'deep' } } }, e: 'flat' }
      const localeObj: LocaleJson = { a: { b: {} }, e: 'plano' }
      expect(findMissingKeys(defaultObj, localeObj)).toEqual({ 'a.b.c.d': 'deep' })
    })

    it('should handle cases where a string in default is an object in locale (and vice-versa) correctly by treating the path as missing if default expects a string', () => {
      const defaultObj: LocaleJson = { a: '1', b: { c: '2' } }
      const localeObj1: LocaleJson = { a: { nested: 'oops' }, b: { c: 'dos' } }
      expect(findMissingKeys(defaultObj, localeObj1)).toEqual({ a: '1' })

      const localeObj2: LocaleJson = { a: 'uno', b: 'not nested' }
      expect(findMissingKeys(defaultObj, localeObj2)).toEqual({ 'b.c': '2' })
    })
  })

  describe('mergeMissingTranslations', () => {
    it('should return missingTranslations if existingTranslations is empty', () => {
      const existing: LocaleJson = {}
      const missing: LocaleJson = { 'a': '1', 'b.c': '2' }
      const expected: LocaleJson = { a: '1', b: { c: '2' } }
      expect(mergeMissingTranslations(existing, missing)).toEqual(expected)
    })

    it('should return existingTranslations if missingTranslations is empty', () => {
      const existing: LocaleJson = { a: 'uno', b: { c: 'dos' } }
      const missing: LocaleJson = {}
      expect(mergeMissingTranslations(existing, missing)).toEqual(existing)
    })

    it('should merge simple root level keys', () => {
      const existing: LocaleJson = { a: 'uno' }
      const missing: LocaleJson = { b: '2' }
      const expected: LocaleJson = { a: 'uno', b: '2' }
      expect(mergeMissingTranslations(existing, missing)).toEqual(expected)
    })

    it('should merge nested keys from dot notation', () => {
      const existing: LocaleJson = { a: 'uno' }
      const missing: LocaleJson = { 'b.c': '2', 'b.d.e': '3' }
      const expected: LocaleJson = { a: 'uno', b: { c: '2', d: { e: '3' } } }
      expect(mergeMissingTranslations(existing, missing)).toEqual(expected)
    })

    it('should merge into existing nested structures', () => {
      const existing: LocaleJson = { a: 'uno', b: { c: 'dos' } }
      const missing: LocaleJson = { 'b.d': '3', 'f.g': '4' }
      const expected: LocaleJson = { a: 'uno', b: { c: 'dos', d: '3' }, f: { g: '4' } }
      expect(mergeMissingTranslations(existing, missing)).toEqual(expected)
    })

    it('should correctly overwrite an existing key if present in missing (though ideally findMissingKeys prevents this exact scenario)', () => {
      const existing: LocaleJson = { a: 'original', b: { c: 'original_c' } }
      const missing: LocaleJson = { 'a': 'new', 'b.c': 'new_c' }
      const expected: LocaleJson = { a: 'new', b: { c: 'new_c' } } // Values from missing should take precedence
      expect(mergeMissingTranslations(existing, missing)).toEqual(expected)
    })

    it('should create deeply nested structures from dot notation keys', () => {
      const existing: LocaleJson = {}
      const missing: LocaleJson = { 'a.b.c.d.e': 'deep value' }
      const expected: LocaleJson = { a: { b: { c: { d: { e: 'deep value' } } } } }
      expect(mergeMissingTranslations(existing, missing)).toEqual(expected)
    })

    it('should handle undefined existingTranslations by returning missingTranslations (converted to nested form)', () => {
      const missing: LocaleJson = { 'a.b': 'test' }
      const expected = { a: { b: 'test' } }
      expect(mergeMissingTranslations(undefined as any, missing)).toEqual(expected)
    })

    it('should handle undefined missingTranslations by returning existingTranslations', () => {
      const existing: LocaleJson = { a: 'test' }
      expect(mergeMissingTranslations(existing, undefined as any)).toEqual(existing)
    })

    it('should return an empty object if both are undefined', () => {
      expect(mergeMissingTranslations(undefined as any, undefined as any)).toEqual({})
    })

    it('should correctly merge when a path in missing is a string but existing has it as object (and vice versa) - missing overwrites', () => {
      const existing1: LocaleJson = { a: { nested: 'object' } }
      const missing1: LocaleJson = { a: 'string' }
      const expected1: LocaleJson = { a: 'string' }
      expect(mergeMissingTranslations(existing1, missing1)).toEqual(expected1)

      const existing2: LocaleJson = { a: 'string' }
      const missing2: LocaleJson = { 'a.b': 'nested object' }
      const expected2: LocaleJson = { a: { b: 'nested object' } }
      expect(mergeMissingTranslations(existing2, missing2)).toEqual(expected2)
    })
  })

  describe('resolveContextLocales', () => {
    const mockI18nConfig: I18nConfig = {
      locales: ['en-US', 'es-ES', 'fr-FR', 'ja-JP'],
      defaultLocale: 'en-US',
    }
    const targetLocales = ['es-ES', 'fr-FR']

    it('should return an empty array for "none"', () => {
      expect(resolveContextLocales('none', mockI18nConfig, targetLocales)).toEqual([])
    })

    it('should return default locale for "def"', () => {
      expect(resolveContextLocales('def', mockI18nConfig, targetLocales)).toEqual(['en-US'])
    })

    it('should return target locales for "tgt"', () => {
      expect(resolveContextLocales('tgt', mockI18nConfig, targetLocales)).toEqual(['es-ES', 'fr-FR'])
    })

    it('should return default and target locales for "both"', () => {
      const result = resolveContextLocales('both', mockI18nConfig, targetLocales)
      expect(result).toHaveLength(3)
      expect(result).toContain('en-US')
      expect(result).toContain('es-ES')
      expect(result).toContain('fr-FR')
    })

    it('should return all locales for "all"', () => {
      const result = resolveContextLocales('all', mockI18nConfig, targetLocales)
      expect(result).toHaveLength(4)
      expect(result).toEqual(expect.arrayContaining(['en-US', 'es-ES', 'fr-FR', 'ja-JP']))
    })

    it('should handle a single specific locale string', () => {
      expect(resolveContextLocales('ja-JP', mockI18nConfig, targetLocales)).toEqual(['ja-JP'])
    })

    it('should handle an array of specific locale strings', () => {
      const result = resolveContextLocales(['ja-JP', 'fr-FR'], mockI18nConfig, targetLocales)
      expect(result).toHaveLength(2)
      expect(result).toContain('ja-JP')
      expect(result).toContain('fr-FR')
    })

    it('should handle a mix of keywords and specific locales', () => {
      const result = resolveContextLocales(['def', 'tgt', 'ja-JP'], mockI18nConfig, targetLocales)
      expect(result).toHaveLength(4)
      expect(result).toContain('en-US')
      expect(result).toContain('es-ES')
      expect(result).toContain('fr-FR')
      expect(result).toContain('ja-JP')
    })

    it('should handle a mix of "all" and other things (all should dominate)', () => {
      const result = resolveContextLocales(['all', 'def', 'ja-JP'], mockI18nConfig, targetLocales)
      expect(result).toHaveLength(4)
      expect(result).toEqual(expect.arrayContaining(['en-US', 'es-ES', 'fr-FR', 'ja-JP']))
    })

    it('should normalize short locale codes', () => {
      expect(resolveContextLocales(['ja', 'es'], mockI18nConfig, targetLocales)).toEqual(['ja-JP', 'es-ES'])
    })

    it('should handle empty target locales for "tgt"', () => {
      expect(resolveContextLocales('tgt', mockI18nConfig, [])).toEqual([])
    })

    it('should return unique locales even if specified multiple times', () => {
      const result = resolveContextLocales(['def', 'en-US', 'es', 'es-ES'], mockI18nConfig, targetLocales)
      expect(result).toHaveLength(2)
      expect(result).toContain('en-US')
      expect(result).toContain('es-ES')
    })

    it('should return an empty array if withConfig is undefined or empty array', () => {
      expect(resolveContextLocales(undefined as any, mockI18nConfig, targetLocales)).toEqual([])
      expect(resolveContextLocales([], mockI18nConfig, targetLocales)).toEqual([])
    })
  })
})
