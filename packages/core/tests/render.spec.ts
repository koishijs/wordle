import assert from 'node:assert'

import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import { App, Element, Session } from 'koishi'

import { defineVariation, Wordle } from '../src'

// Layout constants used by Wordle.prototype.render in ../src
const CELL = 60 // size of one letter box
const GAP = 5 // gap between boxes / rows
const HEADER = 68 // title area height
const PAD = 20 // top/bottom padding around the header

// Height formula after the #26 fix: 65 * rows + 113
const expectedWidth = (letters: number) => letters * CELL + GAP * (letters + 1)
const expectedHeight = (rows: number) =>
  rows * CELL + GAP * (rows + 1) + HEADER + PAD * 2

interface Frame {
  width: number
  height: number
  rects: { x: number, y: number, w: number, h: number }[]
}

class FakeCtx {
  width: number
  height: number
  fillStyle = ''
  font = ''
  textAlign = ''
  textBaseline = ''
  rects: { x: number, y: number, w: number, h: number }[] = []

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.rects.push({ x, y, w, h })
  }

  fillText() {}
}

describe('core: canvas rendering with more than guessCount guesses (#26)', function () {
  const app = new App()
  const frames: Frame[] = []

  app.plugin(mock)
  app.plugin(memory)

  const wordle = defineVariation({
    name: 'wordle-render-test',
    command: 'wordle',
    Config: require('koishi').Schema.object({}),
    validWords: [
      'hello',
      'crown',
      'panic',
      'index',
      'leben',
      'crane',
      'slate',
      'pound',
    ].map((word) => word.split('')),
    async getCurrentWord() {
      return 'hello'.split('')
    },
  })
  wordle.inject = []
  wordle.prototype.render = async function (
    word: Wordle.UnitResult<string>[],
    guessedWords: Wordle.VerificatedResult[],
  ) {
    return word.map((unit) => {
      if (unit.type === 'correct') {
        return `[${unit.char}]`
      }
      else if (unit.type === 'bad-position') {
        return `(${unit.char})`
      }
      else {
        return unit.char
      }
    }).join('')
  }

  app.plugin(wordle)
  const client = app.mock.client('123', 'group')

  app.i18n.define('zh', {
    wordle: {
      messages: {
        'game-started': 'game-started',
        'game-ended': 'game-ended',
        'not-started': 'not-started',
        'no-input': 'no-input',
        'correct': 'correct',
        'invalid': 'invalid',
        'bad-length': 'bad-length',
        'game-over': 'game-over',
      },
    },
  })

  before(function () { return app.start() })

  after(function () { return app.stop() })

  /**
   * Call the real (unmocked) render implementation against a fake canvas and
   * capture the requested image dimensions. The session only needs to expose
   * `app.canvas`, which is exactly what render() touches.
   */
  async function captureRender(
    guessedRows: number,
    letters = 2,
  ): Promise<Frame> {
    frames.length = 0
    const VariationClass = defineVariation({
      name: `wordle-render-capture-${guessedRows}`,
      command: `unused-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      Config: require('koishi').Schema.object({}),
      validWords: ['hello'].map((w) => w.split('')),
      async getCurrentWord() {
        return 'hello'.split('')
      },
    })
    const instance = new (VariationClass as any)(app, {})
    const fakeCanvas = {
      render: async (
        width: number,
        height: number,
        draw: (ctx: unknown) => void,
      ) => {
        const ctx: any = new FakeCtx(width, height)
        draw(ctx)
        frames.push({ width, height, rects: ctx.rects })
        return Element('img', { src: '' })
      },
    }
    const sessionStub = { app: { canvas: fakeCanvas } } as unknown as Session
    const unitResults: Wordle.UnitResult<string>[] = Array.from(
      { length: letters },
      (_, i) => ({ type: i % 2 ? 'bad-position' : 'incorrect', char: String.fromCharCode(97 + i) }),
    )
    const history: Wordle.VerificatedResult[] = Array.from(
      { length: guessedRows - 1 },
      () => ({
        type: 'incorrect',
        unitResults: Array.from({ length: letters }, () => ({
          type: 'incorrect',
          char: 'x',
        })),
      }),
    )
    await (instance as any).render(unitResults, history, sessionStub)
    assert.strictEqual(frames.length, 1)
    return frames[0]
  }

  it('sizes a fresh board for guessCount rows', async function () {
    const frame = await captureRender(1)
    assert.strictEqual(frame.width, expectedWidth(2))
    assert.strictEqual(frame.height, expectedHeight(6))
  })

  it('does not shrink when fewer guesses have been made', async function () {
    const frame = await captureRender(4)
    assert.strictEqual(frame.height, expectedHeight(6))
  })

  it('#26: grows the board when more than guessCount guesses are rendered', async function () {
    /*
     * 8 stored wrong guesses + current row = 9 rows > guessCount (6).
     * Before the fix the canvas stayed at 503px tall and the last three
     * guess rows were drawn outside of the picture.
     */
    const frame = await captureRender(9)
    assert.strictEqual(frame.height, expectedHeight(9))
    assert.strictEqual(frame.width, expectedWidth(2))
  })

  it('#26: every rendered guess row fits inside the canvas', async function () {
    const rows = 12 // way past the six-guess limit
    const frame = await captureRender(rows)
    const startY = HEADER + PAD * 2
    const contentBottom =
      startY + (rows - 1) * (CELL + GAP) + CELL
    assert.ok(frame.height >= contentBottom)
    // all letter boxes were actually painted (+ 1 white background rect)
    assert.strictEqual(frame.rects.length, rows * 2 + 1)
    for (const rect of frame.rects.slice(1)) {
      assert.ok(rect.y + rect.h <= frame.height)
    }
  })

  it('group chat: full game flow still works with the resized board', async function () {
    await client.shouldReply('wordle', 'game-started')
    // five valid but wrong guesses (max allowed before game-over at guessCount=6)
    await client.shouldReply('wordle panic', /panic/)
    await client.shouldReply('wordle index', /ind\(e\)x/)
    await client.shouldReply('wordle crown', /cr\(o\)wn/)
    await client.shouldReply('wordle leben', /\(l\)\[e\]ben/)
    await client.shouldReply('wordle crane', /cran\(e\)/)
    // winning guess still renders and ends the game cleanly
    await client.shouldReply('wordle hello', /^correct/)
    // state was cleaned up: a new game can start afterwards
    await client.shouldReply('wordle', 'game-started')
    await client.shouldReply('wordle --quit', 'game-ended')
  })
})
