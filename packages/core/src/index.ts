import { Argv, Command, Context, Plugin, Session } from 'koishi'

export interface WordleVariation<WordType extends any[] = string[], MoreUnitResult = WordType[number]>
  extends Omit<Plugin.Object, 'apply'> {
  command: string | Command
  locales?: Record<string, any>
  guessCount?: number
  possibleUnitResults?: readonly MoreUnitResult[]
  init?: (command: Command, ctx: Context) => void
  getCurrentWord: (argv: Argv, ctx: Context) => Promise<WordType>
  validWords?: WordType[]
  validateWord?: (word: WordType[], session: Session, ctx: Context) => Promise<boolean>
  // Game logic and lifecycle
  onGameStart?: (session: Session, ctx: Context) => Promise<void>
  onGameEnd?: (session: Session, ctx: Context) => Promise<void>
  handleInput?: <WordType extends any[] = string[]>(
    input: string,
    state: Wordle.WordleState<WordType>,
    session: Session,
    ctx: Context,
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

export function defineVariation<WordType extends any[] = string[], MoreUnitResult = string>(
  variation: WordleVariation<WordType, MoreUnitResult>,
): Plugin.Constructor {
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
      const guessedWords = state.guessedWords ?? []
      const guessedCount = state.guessedCount ?? 0
      for (let i = 0; i < input.length; i++) {
        const char = input[i]
        if (char === currentWord[i]) {
          unitResults.push({ type: 'correct', char })
          currentWord[i] = ''
        } else if (currentWord.some(char => char === input[i])) {
          unitResults.push({ type: 'bad-position', char })
        } else {
          unitResults.push({ type: 'incorrect', char })
        }
      }
      if (unitResults.every((result) => result.type === 'correct')) {
        // game ended
        sessionState.delete(`${session.guildId}.${session.channelId}`)
        variation.onGameEnd?.(session, ctx)
        state.state = undefined
        return { unitResults, type: 'correct' }
      } else {
        sessionState.set(`${session.guildId}.${session.channelId}`, {
          state: Wordle.GameState.Active,
          currentWord: state.currentWord,
          guessedWords: [...guessedWords, { unitResults, type: 'incorrect' }],
          guessedCount: guessedCount + 1,
        })
        return { unitResults, type: 'incorrect' }
      }
    }

  return class {
    _variation = variation
    // re-export koishi fields
    name = variation.name
    static Config = variation.Config
    static schema = variation.schema
    static using = variation.using
    static reusable = variation.reusable
    static reactive = variation.reactive

    constructor(ctx: Context) {
      // define locales
      ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
      ctx.i18n.define('zh', require('./locales/zh-CN'))

      if (variation.locales) {
        Object.entries(variation.locales).forEach(([locale, data]) => {
          ctx.i18n.define(locale, data)
        })
      }

      command = typeof variation.command === 'string' ? ctx.command(variation.command) : variation.command
      variation.init?.(command, ctx)

      command.action(async (argv, word) => {
        const { session } = argv
        const state = sessionState.get(`${session.guildId}.${session.channelId}`)
        if (state?.state !== Wordle.GameState.Active && word) {
          return session?.text('wordle.messages.not-started', [command.name])
        }
        if (state?.state === Wordle.GameState.Active) {
          if (word) {
            const result = await handleInput(word, state, session, ctx)
            let text = ''
            switch (result.type) {
              case 'bad-length':
                text = session?.text('wordle.messages.bad-length')
                break
              case 'invalid':
                text = session?.text('wordle.messages.invalid')
                break
              case 'correct':
                text = session?.text('wordle.messages.correct')
                break
              case 'incorrect':
                text = this.formatTable(result.unitResults, state.guessedWords ?? [], session)
                state.guessedWords = [...(state.guessedWords ?? []), result]
                break
            }

            await session.send(text)

            if (state.guessedCount >= variation.guessCount ?? 6) {
              await session.send(session?.text('wordle.messages.game-over', [command.name, state.currentWord.join('')]))
              variation.onGameEnd?.(session, ctx)
              sessionState.delete(`${session.guildId}.${session.channelId}`)
            }
          } else {
            return session?.text('wordle.messages.no-input')
          }
        } else {
          // start a new game
          variation.onGameStart?.(session, ctx)
          const currentWord = await this.getCurrentWord(argv, ctx)
          sessionState.set(`${session.guildId}.${session.channelId}`, { state: Wordle.GameState.Active, currentWord })
          await session.send(session?.text('wordle.messages.game-started', [command.name, variation.guessCount ?? 6]))
        }
      })
    }

    getCurrentWord(argv: Argv, ctx: Context) {
      return variation.getCurrentWord(argv, ctx)
    }

    formatTable(word: Wordle.UnitResult<any>[], guessedWords: Wordle.VerificatedResult[], session: Session): string {
      const lines: string[] = []
      ;[...guessedWords.map((item) => item.unitResults), word].forEach((result) => {
        let line: string = ''
        result.forEach((unit) => {
          switch (unit.type) {
            case 'correct':
              line += (`[${unit.char}]`)
              break
            case 'bad-position':
              line += (`(${unit.char})`)
              break
            case 'incorrect':
              line += (` ${unit.char} `)
              break
          }
        })

        lines.push(line)
      })
      lines.push(session.text('wordle.messages.text-hint'))

      return lines.join('\n')
    }
  }
}
