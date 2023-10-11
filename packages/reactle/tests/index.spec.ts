import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import { Wordle } from '@koishijs/wordle'
import { App, Session } from 'koishi'

import reactle from '../src'

describe('reactle', () => {
  const app = new App()

  app.plugin(mock)
  app.plugin(memory)
  // set getCurrentWord always return 'hello'
  ;(reactle as any).prototype.getCurrentWord = () => Promise.resolve(['h', 'e', 'l', 'l', 'o'])
  if ((reactle as any).using?.includes('canvas')) {
    const index = (reactle as any).using.indexOf('canvas')
    ;(reactle as any).using.splice(index, 1)
  }
  reactle.prototype.render = async function (
    word: Wordle.UnitResult<any>[],
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
    await client.shouldReply('reactle crown', /cr\(o\)wn/)
    await client.shouldReply('reactle hello', 'correct')
  })
})
