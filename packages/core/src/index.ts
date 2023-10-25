import {} from '@koishijs/canvas'
import { Argv, Command, Context, Element, h, Plugin, Session, Schema } from 'koishi'

export interface VariationInstanceLike<T = any> {
  ctx: Context
  config: T
}

export interface WordleVariation<
  Config = any,
  ConfigSchema = Schema<Config>,
  WordType extends any[] = string[],
  MoreUnitResult = WordType[number],
> extends Omit<Plugin.Object, 'Config' | 'apply'> {
  command: string | Command
  Config: ConfigSchema
  locales?: Record<string, any>
  guessCount?: number
  possibleUnitResults?: readonly MoreUnitResult[]
  init?: (command: Command, cls: VariationInstanceLike<Config>) => void
  getCurrentWord: (argv: Argv, cls: VariationInstanceLike<Config>) => Promise<WordType>
  validWords?: WordType[]
  validateWord?: (word: WordType[], argv: Argv, cls: VariationInstanceLike<Config>) => Promise<boolean>
  // Game logic and lifecycle
  onGameStart?: (argv: Argv, cls: VariationInstanceLike<Config>) => Promise<void>
  onGameEnd?: (argv: Argv, ctx: Context) => Promise<void>
  handleInput?: <WordType extends any[] = string[]>(
    input: string,
    state: Wordle.WordleState<WordType>,
    argv: Argv,
    cls: VariationInstanceLike<Config>,
  ) => Promise<Wordle.VerificatedResult<MoreUnitResult>>
}

export namespace Wordle {
  export enum GameState {
    Active = 'active',
  }

  export interface WordleState<WordType extends any[] = string[]> {
    state?: GameState
    currentWord: WordType
    guessedWords?: VerificatedResult<any>[]
    guessedCount?: number
  }

  export type UnitResultType = 'correct' | 'bad-position' | 'incorrect'

  export interface UnitResult<MoreUnitResult, WordType extends any[] = string[]> {
    type: UnitResultType | MoreUnitResult
    char: WordType[number]
  }

  export interface VerificatedResult<MoreUnitResult = string> {
    unitResults: UnitResult<MoreUnitResult>[]
    type: 'invalid' | 'bad-length' | UnitResultType
  }
}

export function defineVariation<
  Config = any,
  ConfigSchema = Schema<Config>,
  WordType extends any[] = string[],
  MoreUnitResult = string,
>(variation: WordleVariation<Config, ConfigSchema, WordType, MoreUnitResult>): Plugin.Constructor {
  let command: Command
  const sessionState = new Map<string, Wordle.WordleState<WordType>>()

  const handleInput =
    variation.handleInput ??
    async function (input, state: Wordle.WordleState<WordType>, session, ctx) {
      const unitResults: Wordle.UnitResult<MoreUnitResult>[] = []
      if (input.length !== state.currentWord.length) {
        return { unitResults, type: 'bad-length' }
      }
      // check if word is in the word list
      if (variation.validWords) {
        if (!variation.validWords.some((word) => word.join('') === input)) {
          return { unitResults, type: 'invalid' }
        }
      }
      if (variation.validateWord) {
        if (!(await variation.validateWord(input.split('') as unknown as WordType[], session, ctx))) {
          return { unitResults, type: 'invalid' }
        }
      }

      const currentWord = [...state.currentWord]
      for (let i = 0; i < input.length; i++) {
        const char = input[i]
        if (char === currentWord[i]) {
          unitResults.push({ type: 'correct', char })
          currentWord[i] = ''
        } else if (currentWord.some((char) => char === input[i])) {
          unitResults.push({ type: 'bad-position', char })
        } else {
          unitResults.push({ type: 'incorrect', char })
        }
      }
      if (unitResults.every((result) => result.type === 'correct')) {
        return { unitResults, type: 'correct' }
      } else {
        return { unitResults, type: 'incorrect' }
      }
    }

  return class {
    _variation = variation
    // re-export koishi fields
    name = variation.name
    static Config = variation.Config
    static schema = variation.schema
    static using = Array.from(new Set(['canvas', ...(variation.using ?? [])]))
    static reusable = variation.reusable
    static reactive = variation.reactive

    constructor(
      public ctx: Context,
      public config: Config,
    ) {
      // define locales
      ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
      // register global command messages for this variation
      ctx.i18n.define('zh-CN', {
        commands: {
          [typeof variation.command === 'string'
            ? variation.command
            : variation.command.name]: require('./locales/commands.zh-CN'),
        },
      })

      if (variation.locales) {
        Object.entries(variation.locales).forEach(([locale, data]) => {
          ctx.i18n.define(locale, data)
        })
      }

      command = typeof variation.command === 'string' ? ctx.command(variation.command) : variation.command
      variation.init?.(command, this)
      command.option('quit', '-q')

      command.action(async (argv, word) => {
        const { session } = argv
        const state = sessionState.get(`${session.guildId}.${session.channelId}`)
        if ((argv.options as any).quit) {
          if (state?.state !== Wordle.GameState.Active) {
            return session?.text('wordle.messages.not-started', [command.name])
          }
          sessionState.delete(`${session.guildId}.${session.channelId}`)
          variation.onGameEnd?.(argv, ctx)
          return session?.text('wordle.messages.game-ended', [command.name, state.currentWord.join('')])
        }

        if (state?.state !== Wordle.GameState.Active && word) {
          return session?.text('wordle.messages.not-started', [command.name])
        }
        if (state?.state === Wordle.GameState.Active) {
          if (word) {
            const result = await handleInput(word, state, argv, this)
            const text: Element[] = []
            switch (result.type) {
              case 'bad-length':
                text.push(h.text(session?.text('wordle.messages.bad-length')))
                break
              case 'invalid':
                text.push(h.text(session?.text('wordle.messages.invalid')))
                break
              case 'correct':
                text.push(h.text(session?.text('wordle.messages.correct')))
              // Note: here we do not use `break` here as we need to render the result as well
              // eslint-disable-next-line no-fallthrough
              case 'incorrect':
                text.push(await this.render(result.unitResults, state.guessedWords ?? [], session))
                break
            }

            await session.send(text)

            if (result.type === 'correct') {
              // game ended
              sessionState.delete(`${session.guildId}.${session.channelId}`)
              variation.onGameEnd?.(argv, ctx)
            } else if (state.guessedCount >= variation.guessCount ?? 6) {
              await session.send(session?.text('wordle.messages.game-over', [command.name, state.currentWord.join('')]))
              variation.onGameEnd?.(argv, ctx)
              sessionState.delete(`${session.guildId}.${session.channelId}`)
            } else if (result.type === 'incorrect') {
              sessionState.set(`${session.guildId}.${session.channelId}`, {
                state: Wordle.GameState.Active,
                currentWord: state.currentWord,
                guessedWords: [...(state.guessedWords ?? []), result],
                guessedCount: state.guessedCount + 1,
              })
            }
          } else {
            return session?.text('wordle.messages.no-input', [command.name])
          }
        } else {
          // start a new game
          variation.onGameStart?.(argv, this)
          const currentWord = await this.getCurrentWord(argv, ctx)
          sessionState.set(`${session.guildId}.${session.channelId}`, { state: Wordle.GameState.Active, currentWord })
          await session.send(session?.text('wordle.messages.game-started', [command.name, variation.guessCount ?? 6]))
        }
      })
    }

    getCurrentWord(argv: Argv, ctx: Context) {
      return variation.getCurrentWord(argv, this)
    }

    async render(
      word: Wordle.UnitResult<any>[],
      guessedWords: Wordle.VerificatedResult[],
      session: Session,
    ): Promise<Element> {
      const width = word.length * 60 + 5 * (word.length + 1)
      const height = (variation.guessCount ?? 6) * 60 + 5 * ((variation.guessCount ?? 6) + 1) + 68 + 20 * 2
      return await session.app.canvas.render(width, height, (ctx) => {
        // Set background color to white
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, width, height)
        // Draw centered header
        ctx.font = 'bold 68px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#000'
        ctx.fillText(
          command.name.replace(/^./, (p) => p.toLocaleUpperCase()),
          width / 2,
          68 / 2 + 20,
        )

        let y = 68 + 20 * 2
        ctx.font = 'bold 36px sans-serif'
        // Draw every line of word
        for (const w of [...guessedWords, { unitResults: word, type: '' }]) {
          let x = 5
          for (const letter of w.unitResults) {
            ctx.fillStyle =
              letter.type === 'correct' ? '#6aaa64' : letter.type === 'bad-position' ? '#c9b458' : '#787c7e'
            ctx.fillRect(x, y, 60, 60)
            ctx.fillStyle = '#fff'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(letter.char.toLocaleUpperCase(), x + 60 / 2, y + 60 / 2 + 2)
            x += 60 + 5
          }

          y += 60 + 5
        }
      })
    }
  }
}
