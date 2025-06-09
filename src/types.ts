export type DeepReadonly<T> = {
  readonly [K in keyof T]: keyof T[K] extends never ? T[K] : DeepReadonly<T[K]>
}

export type DeepPartial<T> = {
  [K in keyof T]?: keyof T[K] extends never ? T[K] : DeepPartial<T[K]>
}

export type DeepRequired<T> = {
  [K in keyof T]-?: keyof T[K] extends never ? T[K] : DeepRequired<T[K]>
}

type Primitive = string | number | boolean | null | undefined

export type NestedKeyOf<T> = T extends Primitive
  ? never
  : T extends (infer Elem)[]
    ? NestedKeyOf<Elem> extends never
      ? `${number}`
      : `${number}` | `${number}.${NestedKeyOf<Elem>}`
    : {
        [K in keyof T & (string | number)]:
        NestedKeyOf<T[K]> extends never
          ? `${K}`
          : `${K}` | `${K}.${NestedKeyOf<T[K]>}`
      }[keyof T & (string | number)]

export type NestedValueOf<T, K extends string> = K extends keyof T
  ? T[K]
  : K extends `${infer F}.${infer R}`
    ? F extends keyof T
      ? NestedValueOf<T[F], R>
      : never
    : never

export type DeleteType<T, K extends string> = K extends keyof T
  ? Omit<T, K>
  : K extends `${infer F}.${infer R}`
    ? F extends keyof T
      ? Omit<T, F> & Record<F, DeleteType<T[F], R>>
      : T
    : T
