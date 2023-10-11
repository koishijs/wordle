import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import { App, Session, Schema } from 'koishi'

import { defineVariation, Wordle } from '../src'

describe('core', () => {
  const app = new App()

  app.plugin(mock)
  app.plugin(memory)

  const wordle = defineVariation({
    name: 'wordle-core-test',
    command: 'wordle',
    Config: Schema.object({}),
    validWords: ['hello', 'crown', 'panic', 'index', 'leben'].map((word) => word.split('')),
    async getCurrentWord(session, ctx) {
      return 'hello'.split('')
    },
  })
  if ((wordle as any).using?.includes('canvas')) {
    const index = (wordle as any).using.indexOf('canvas')
    ;(wordle as any).using.splice(index, 1)
  }
  wordle.prototype.render = async function (
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

  app.plugin(wordle)

  before(() => app.start())
  after(() => app.stop())

  const client = app.mock.client('123', 'group')

  app.i18n.define('zh', {
    wordle: {
      messages: {
        'game-started': 'game-started',
        'game-ended': 'game-ended',
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
    await client.shouldReply('wordle crown', /cr\(o\)wn/)
  })

  it('should output correct', async () => {
    await client.shouldReply('wordle hello', 'correct')
  })

  it('should exit the game', async () => {
    await client.shouldReply('wordle', 'game-started')
    await client.shouldReply('wordle --exit', 'game-ended')
  })
})
