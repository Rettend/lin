import type { DeleteType, NestedKeyOf, NestedValueOf } from '@/types'

type NestedObject = Record<string | number, any>

export function findNestedKey<T extends NestedObject, K extends NestedKeyOf<T>>(
  obj: T,
  key: K,
) {
  const keys = key.split('.').map(k => !Number.isNaN(Number(k)) ? Number(k) : k)
  let current: any = obj
  const parents: any[] = []

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (!(k in current))
      current[k] = typeof keys[i + 1] === 'number' ? [] : {}

    parents.push(current)
    current = current[k]
  }

  const lastKey = keys[keys.length - 1]

  return {
    value: current[lastKey] as NestedValueOf<T, K>,
    delete: (): DeleteType<T, K> => {
      delete current[lastKey]
      return obj as DeleteType<T, K>
    },
  }
}

export function findNestedValue(obj: any, path: string): any {
  if (!path)
    return obj

  let current = obj
  for (const part of path.split('.')) {
    if (typeof current === 'object' && current !== null && Object.prototype.hasOwnProperty.call(current, part))
      current = current[part]
    else
      return undefined
  }
  return current
}

export function countKeys(obj: NestedObject): number {
  return getAllKeys(obj).length
}

export function sortKeys(obj: NestedObject, refObj?: NestedObject): NestedObject {
  if (typeof obj !== 'object' || obj === null)
    return obj

  if (Array.isArray(obj))
    return obj.map(item => sortKeys(item, undefined))

  const sortedKeys = Object.keys(obj).sort((a, b) => {
    if (refObj === undefined) {
      return a.localeCompare(b)
    }
    else {
      const aInRef = a in refObj
      const bInRef = b in refObj

      if (aInRef && bInRef) {
        const refKeysList = Object.keys(refObj)
        return refKeysList.indexOf(a) - refKeysList.indexOf(b)
      }
      else if (aInRef) {
        return -1
      }
      else if (bInRef) {
        return 1
      }
      else {
        return a.localeCompare(b)
      }
    }
  })

  const sortedObj: NestedObject = {}
  for (const key of sortedKeys) {
    if (refObj && typeof obj[key] === 'object' && obj[key] !== null && typeof refObj[key] === 'object' && refObj[key] !== null)
      sortedObj[key] = sortKeys(obj[key], refObj[key])

    else if (typeof obj[key] === 'object' && obj[key] !== null)
      sortedObj[key] = sortKeys(obj[key])

    else
      sortedObj[key] = obj[key]
  }

  return sortedObj
}

export function getAllKeys(obj: Record<string, any>, prefix = ''): string[] {
  return Object.keys(obj).flatMap((key) => {
    const newKey = prefix ? `${prefix}.${key}` : key
    const value = obj[key]
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (Object.keys(value).length === 0)
        return [newKey]

      return getAllKeys(value, newKey)
    }
    return [newKey]
  })
}

export function cleanupEmptyObjects(obj: any) {
  if (Object.prototype.toString.call(obj) === '[object Array]') {
    for (let i = 0; i < obj.length; i++)
      cleanupEmptyObjects(obj[i])
  }
  else if (Object.prototype.toString.call(obj) === '[object Object]') {
    for (const key in obj) {
      if (Object.prototype.toString.call(obj[key]) === '[object Object]') {
        cleanupEmptyObjects(obj[key])
        if (Object.keys(obj[key]).length === 0)
          delete obj[key]
      }
      else if (Object.prototype.toString.call(obj[key]) === '[object Array]') {
        cleanupEmptyObjects(obj[key])
      }
    }
  }
}

export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
  return Object.keys(obj).reduce((acc, key) => {
    const newKey = prefix ? `${prefix}.${key}` : key
    const value = obj[key]
    if (typeof value === 'object' && value !== null && !Array.isArray(value))
      Object.assign(acc, flattenObject(value, newKey))
    else
      acc[newKey] = String(value)

    return acc
  }, {} as Record<string, string>)
}
