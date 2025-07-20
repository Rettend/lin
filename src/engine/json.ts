import type { FormatAdapter } from './index'

export const jsonAdapter: FormatAdapter = {
  supportedCommands: ['check', 'sync', 'translate', 'add', 'del', 'edit'],
  extract: () => ({}),
  render: (_fp, _s, t) => ({ text: JSON.stringify(t, null, 2), changed: true }),
}
