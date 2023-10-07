import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import { App } from 'koishi'

import reactle from '../src'

describe('reactle', () => {
  const app = new App()

  app.plugin(mock)
  app.plugin(memory)
  // set getCurrentWord always return 'hello'
  ;(reactle as any).prototype.getCurrentWord = () => Promise.resolve(['h', 'e', 'l', 'l', 'o'])
  app.plugin(reactle)

  const client = app.mock.client('123')

  app.i18n.define('zh', {
    wordle: {
      messages: {
        'game-started': 'game-started',
        'correct': 'correct',
        'invalid': 'not a word',
        'bad-length': 'bad length',
      },
    },
  })

  before(() => app.start())
  after(() => app.stop())

  it('get today wordle', async () => {
    await client.shouldReply('reactle', 'game-started')
  })

  it('should process wordle gaming', async () => {
    await client.shouldReply('reactle aaaaa', 'not a word')
    await client.shouldReply('reactle h', 'bad length')
    await client.shouldReply('reactle crown', /c {2}r \(o\) w {2}n/)
    await client.shouldReply('reactle hello', 'correct')
  })
})
