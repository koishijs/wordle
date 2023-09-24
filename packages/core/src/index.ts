import { Command, Context, Plugin, Session } from 'koishi'

export interface WordleVariation<WordType extends any[] = string[], MoreUnitResult = WordType[number]>
  extends Omit<Plugin.Object, 'apply'> {
  command: string | Command
  possibleUnitResults?: readonly MoreUnitResult[]
  init?: (command: Command, ctx: Context) => void
  getCurrentWord: (session: Session, ctx: Context) => Promise<WordType>
  // Game logic and lifecycle
  onGameStart?: (session: Session, ctx: Context) => Promise<void>
  onGameEnd?: (session: Session, ctx: Context) => Promise<void>
  handleInput?: <WordType extends any[] = string[]>(
    input: string,
    state: Wordle.WordleState<WordType>,
    session: Session,
    ctx: Context,
  ) => Promise<Wordle.VarificatedResult<MoreUnitResult>>
}

export namespace Wordle {
  export enum GameState {
    NotStarted = 'not-started',
    Started = 'started',
    Ended = 'ended',
  }

  export interface WordleState<WordType = string> {
    state: GameState
    currentWord: WordType
    guessedWords?: WordType[]
    guessedCount?: number
  }

  export type UnitResultType = 'correct' | 'bad-position' | 'incorrect'

  export interface UnitResult<MoreUnitResult> {
    type: UnitResultType | MoreUnitResult
  }

  export interface VarificatedResult<MoreUnitResult = string> {
    unitResults: UnitResult<MoreUnitResult>[]
    type: 'bad-length' | UnitResultType
  }
}

export function defineVariation<WordType extends any[] = string[], MoreUnitResult = string>(
  variation: WordleVariation<WordType, MoreUnitResult>,
): Plugin.Constructor {
  let command: Command
  const sessionState = new Map<string, Wordle.WordleState<WordType>>()

  const handleInput =
    variation.handleInput ??
    function (input, state: Wordle.WordleState<WordType>, session, ctx) {
      const unitResults: Wordle.UnitResult<MoreUnitResult>[] = []
      if (input.length !== state.currentWord.length) {
        return { unitResults, type: 'bad-length' }
      }
      const currentWord = [...state.currentWord]
      const guessedWords = state.guessedWords ?? []
      const guessedCount = state.guessedCount ?? 0
      for (let i = 0; i < input.length; i++) {
        const char = input[i]
        if (char === currentWord[i]) {
          unitResults.push({ type: 'correct' })
          currentWord[i] = ''
        } else if (currentWord.includes(char)) {
          unitResults.push({ type: 'bad-position' })
        } else {
          unitResults.push({ type: 'incorrect' })
        }
      }
      if (unitResults.every((result) => result.type === 'correct')) {
        // game ended
        sessionState.set(`${session.guildId}.${session.channelId}`, {
          state: Wordle.GameState.Ended,
          currentWord: state.currentWord,
          guessedWords: [...guessedWords, input as unknown as WordType],
          guessedCount: guessedCount + 1,
        })
        variation.onGameEnd?.(session, ctx)
        return { unitResults, type: 'correct' }
      } else {
        sessionState.set(`${session.guildId}.${session.channelId}`, {
          state: Wordle.GameState.Started,
          currentWord: state.currentWord,
          guessedWords: [...guessedWords, input as unknown as WordType],
          guessedCount: guessedCount + 1,
        })
        return { unitResults, type: 'incorrect' }
      }
    }

  return class {
    _variation = variation
    constructor(ctx: Context) {
      // define locales
      ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
      ctx.i18n.define('zh', require('./locales/zh-CN'))

      command = typeof variation.command === 'string' ? ctx.command(variation.command) : variation.command
      variation.init?.(command, ctx)

      command.action(async ({ session }, word) => {
        const state = sessionState.get(`${session.guildId}.${session.channelId}`)
        if ((!state || state?.state === Wordle.GameState.NotStarted) && word) {
          return session?.text('wordle.messages.not-started', [command.name])
        }
        if (state?.state === Wordle.GameState.Started) {
          if (word) {
            handleInput(word, state, session, ctx)
          } else {
            return session?.text('wordle.messages.started', [command.name])
          }
        } else {
          // start a new game
          variation.onGameStart?.(session, ctx)
          const currentWord = await this.getCurrentWord(session, ctx)
          sessionState.set(`${session.guildId}.${session.channelId}`, { state: Wordle.GameState.Started, currentWord })
        }
      })
    }

    getCurrentWord(session: Session, ctx: Context) {
      return variation.getCurrentWord(session, ctx)
    }
  }
}
