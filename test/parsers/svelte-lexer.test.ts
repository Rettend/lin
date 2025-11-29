import { describe, expect, it } from 'vitest'
import { SvelteLexer } from '../../src/parsers/svelte-lexer'

describe('svelteLexer', () => {
  it('should extract translation keys from standard usages', () => {
    const lexer = new SvelteLexer()
    const content = `
      <script>
        import { t } from './i18n'
        console.log(t('hello.world'))
        console.log(t('hello.user', 'Hello User'))
        t('direct.call')
      </script>
      <div>{t('hello.div')}</div>
      <button title={t('hello.attr')}>Click</button>
    `
    const keys = lexer.extract(content)
    expect(keys).toEqual([
      { key: 'hello.world', file: undefined },
      { key: 'hello.user', defaultValue: 'Hello User', file: undefined },
      { key: 'direct.call', file: undefined },
      { key: 'hello.div', file: undefined },
      { key: 'hello.attr', file: undefined },
    ])
  })

  it('should ignore functions ending in t', () => {
    const lexer = new SvelteLexer()
    const content = `
      <script>
        const parts = 'a.b.c'.split('.')
        const other = someFunctiont('should.not.be.extracted')
        const v = variant('nope')
        const s = start('nope')
      </script>
    `
    const keys = lexer.extract(content)
    expect(keys).toEqual([])
  })

  it('should ignore identifiers containing $t but not starting with it', () => {
    const lexer = new SvelteLexer()
    const content = `
      <script>
        const my$t = (k) => k
        my$t('should.not.be.extracted')
        
        const _t = (k) => k
        _t('should.not.be.extracted')
      </script>
    `
    const keys = lexer.extract(content)
    expect(keys).toEqual([])
  })

  it('should handle edge cases with whitespace and punctuation', () => {
    const lexer = new SvelteLexer()
    const content = `
      t('key.1')
       t('key.2')
      (t('key.3'))
      { t('key.4') }
      ;t('key.5')
      +t('key.6')
    `
    const keys = lexer.extract(content)
    expect(keys.map(k => k.key)).toEqual([
      'key.1',
      'key.2',
      'key.3',
      'key.4',
      'key.5',
      'key.6',
    ])
  })
})
