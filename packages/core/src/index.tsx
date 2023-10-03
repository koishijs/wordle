import { Argv, Command, Context, Element, Plugin, Session } from 'koishi'
import {} from 'koishi-plugin-puppeteer'

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
    static using = variation.using
    static reusable = variation.reusable
    static reactive = variation.reactive

    constructor(public ctx: Context) {
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
      command.option('exit', '-e')

      command.action(async (argv, word) => {
        const { session } = argv
        const state = sessionState.get(`${session.guildId}.${session.channelId}`)
        if ((argv.options as any).exit) {
          if (state?.state !== Wordle.GameState.Active) {
            return session?.text('wordle.messages.not-started', [command.name])
          }
          sessionState.delete(`${session.guildId}.${session.channelId}`)
          variation.onGameEnd?.(session, ctx)
          return session?.text('wordle.messages.game-ended', [command.name, state.currentWord.join('')])
        }

        if (state?.state !== Wordle.GameState.Active && word) {
          return session?.text('wordle.messages.not-started', [command.name])
        }
        if (state?.state === Wordle.GameState.Active) {
          if (word) {
            const result = await handleInput(word, state, session, ctx)
            let text: string | Element = ''
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
                text = await this.formatTable(result.unitResults, state.guessedWords ?? [], session)
                break
            }

            await session.send(text)

            if (result.type === 'correct') {
              // game ended
              sessionState.delete(`${session.guildId}.${session.channelId}`)
              variation.onGameEnd?.(session, ctx)
              state.state = undefined
            } else if (state.guessedCount >= variation.guessCount ?? 6) {
              await session.send(session?.text('wordle.messages.game-over', [command.name, state.currentWord.join('')]))
              variation.onGameEnd?.(session, ctx)
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

    async formatTable(
      word: Wordle.UnitResult<any>[],
      guessedWords: Wordle.VerificatedResult[],
      session: Session,
    ): Promise<string | Element> {
      const lines: string[] = []

      if (this.ctx.puppeteer) {
        return (
          <html>
            <div>
              <style>{`
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                body {
                  width: 400px;
                  padding: 20px;
                  font-family:
                    -apple-system, "Microsoft Yahei", "PingFang SC", "Helvetica Neue", "Helvetica", "Arial", sans-serif;
                  font-size: '24px';
                  font-weight: 'bold';
                }
              `}</style>
              <h1 style={{ textAlign: 'center', fontSize: '68px', textTransform: 'capitalize' }}>{command.name}</h1>
              <div style={{ width: '100%' }}>
                {[...guessedWords.map((item) => item.unitResults), word].map((items) => (
                  <div
                    style={{
                      marginTop: '5px',
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gridGap: '5px',
                    }}
                  >
                    {items.map((item) => (
                      <span
                        style={{
                          fontSize: '40px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          width: '100%',
                          aspectRatio: '1/1',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          color: 'white',
                          backgroundColor:
                            item.type === 'correct' ? '#6aaa64' : item.type === 'bad-position' ? '#c9b458' : '#787c7e',
                        }}
                      >
                        {item.char}
                      </span>
                    ))}
                  </div>
                ))}

                {Array.from({ length: (this._variation.guessCount ?? 6) - guessedWords.length - 1 }).map(() => (
                  <div
                    style={{
                      marginTop: '5px',
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gridGap: '5px',
                    }}
                  >
                    {Array.from({ length: word.length }).map(() => (
                      <span
                        style={{
                          display: 'flex',
                          width: '100%',
                          aspectRatio: '1/1',
                          border: '2px solid #3a3a3c',
                        }}
                      >
                        &nbsp;
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </html>
        )
      } else {
        ;[...guessedWords.map((item) => item.unitResults), word].forEach((result) => {
          let line: string = ''
          result.forEach((unit) => {
            switch (unit.type) {
              case 'correct':
                line += `[${unit.char}]`
                break
              case 'bad-position':
                line += `(${unit.char})`
                break
              case 'incorrect':
                line += ` ${unit.char} `
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
}
