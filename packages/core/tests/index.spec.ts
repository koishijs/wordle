import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import { App } from 'koishi'

import { defineVariation } from '../src'

describe('core', () => {
  const app = new App()

  app.plugin(mock)
  app.plugin(memory)
  app.plugin(
    defineVariation({
      name: 'wordle-core-test',
      command: 'wordle',
      validWords: ['hello', 'crown', 'panic', 'index', 'leben'].map((word) => word.split('')),
      async getCurrentWord(session, ctx) {
        return 'hello'.split('')
      },
    }),
  )

  before(() => app.start())
  after(() => app.stop())

  const client = app.mock.client('123', 'group')

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

  it('should start a game', async () => {
    await client.shouldReply('wordle', 'game-started')
  })

  it('should flag a wrong word', async () => {
    await client.shouldReply('wordle aaaaa', 'not a word')
  })

  it('should flag a word with wrong length', async () => {
    await client.shouldReply('wordle h', 'bad length')
  })

  it('should output guessed words', async () => {
    await client.shouldReply('wordle crown', /c {2}r \(o\) w {2}n/)
  })

  it('should output correct', async () => {
    await client.shouldReply('wordle hello', 'correct')
  })
})
