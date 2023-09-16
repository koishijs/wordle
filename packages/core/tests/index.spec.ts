import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import { App } from 'koishi'

import { defineVariation } from '../src'

describe('wordle', () => {
  const app = new App()

  app.plugin(mock)
  app.plugin(memory)
  app.plugin(
    defineVariation({
      name: 'wordle-core-test',
      command: 'wordle',
      async getCurrentWord(session, ctx) {
        return 'hello'.split('')
      },
      async handleInput(input, state, session, ctx) {
        const { currentWord } = state
        if (input.length !== currentWord.length) {
          return { type: 'bad-length', unitResults: [] }
        }
        let type = 'correct' as 'correct' | 'incorrect'
        const unitResults = input.split('').map((char, index) => {
          if (char === currentWord[index]) {
            return { type: 'correct' }
          } else if (currentWord.includes(char)) {
            type = 'incorrect'
            return { type: 'bad-position' }
          } else {
            type = 'incorrect'
            return { type: 'incorrect' }
          }
        })
        return { type, unitResults }
      },
    }),
  )

  before(() => app.start())
  after(() => app.stop())

  const client = app.mock.client('123', 'group')

  it('should start a game', async () => {
    await client.shouldReply('wordle', 'game started')
  })
})
