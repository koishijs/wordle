import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import { App } from 'koishi'

import wordle from '../src'

describe('wordle', () => {
  const app = new App()

  app.plugin(mock)
  app.plugin(memory)
  // set getCurrentWord always return 'hello'
  ;(wordle as any).prototype.getCurrentWord = () => Promise.resolve(['h', 'e', 'l', 'l', 'o'])
  app.plugin(wordle)

  const client = app.mock.client('123')

  app.i18n.define('zh', {
    wordle: {
      messages: {
        'correct': 'correct',
        'invalid': 'not a word',
        'bad-length': 'bad length',
      },
    },
  })

  before(() => app.start())
  after(() => app.stop())

  it('get today wordle', async () => {
    await client.shouldReply('wordle')
  })

  it('should process wordle gaming', async () => {
    await client.shouldReply('wordle aaaaa', 'not a word')
    await client.shouldReply('wordle h', 'bad length')
    await client.shouldReply('wordle crown', /c {2}r \(o\) w {2}n/)
    await client.shouldReply('wordle hello', 'correct')
  })
})
