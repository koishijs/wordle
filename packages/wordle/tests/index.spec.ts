import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import { Wordle } from '@koishijs/wordle'
import { App, Session } from 'koishi'

import wordle from '../src'

describe('wordle', () => {
  const app = new App()

  app.plugin(mock)
  app.plugin(memory)
  // set getCurrentWord always return 'hello'
  wordle.prototype.getCurrentWord = () => Promise.resolve(['h', 'e', 'l', 'l', 'o'])
  wordle.inject = []
  wordle.prototype.render = async function (
    word: Wordle.UnitResult<unknown>[],
    guessedWords: Wordle.VerificatedResult[],
    session: Session,
  ) {
    return word.map((unit) => {
      if (unit.type === 'correct') {
        return `[${unit.char}]`
      } else if (unit.type === 'bad-position') {
        return `(${unit.char})`
      } else {
        return unit.char
      }
    }).join('')
  }
  app.plugin(wordle)

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
    await client.shouldReply('wordle', 'game-started')
  })

  it('should process wordle gaming', async () => {
    await client.shouldReply('wordle aaaaa', 'not a word')
    await client.shouldReply('wordle h', 'bad length')
    await client.shouldReply('wordle crown', /cr\(o\)wn/)
    await client.shouldReply('wordle hello', /^correct/)
  })
})
