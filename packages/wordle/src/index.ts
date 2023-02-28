import { WordleCore } from '@koishijs/wordle/src'
import { Context, Schema, Time, Random } from 'koishi'

function make2dArray<T extends any>(row: number, column: number, value?: T): T[][] {
  const array = []
  for (let i = 0; i < column; i++) {
    array[i] = []
    for (let j = 0; j < row; j++) {
      array[i][j] = value
    }
  }
  return array
}

export class Wordle extends WordleCore {
  constructor(ctx: Context, config: Wordle.Config) {
    super(ctx, config)
    ctx.i18n.define('zh', require('./locales/zh-CN'))

    ctx.command('wordle')
      .option('random', '-r', { descPath: '' })
      .action(async ({ session, options }) => {
        await session.send(session.text('.start'))
        const solution = await (options ? this.getRandomWord() : this.getTodayWord())
        const input = make2dArray<WordleCore.Character>(5, 6)

        let count = 0
        while (count < 6) {
          const chars = this.validateInput(await session.prompt(180000), solution)
          if (!chars) {
            await session.send('wordle.errors.invalid-word')
            continue
          }

          input[count] = chars

          await session.send(config.imageMode ? this.render(input)
            : session.text('wordle.core.text-mode', [this.render(input)]),
          )
          if (chars.every(c => c.stage === 'correct')) break
          count++
        }
        if (count < 6) return session.text('.win')
        return session.text('.lose')
      })
  }

  async getTodayWord(date?: string) {
    if (!this.todayWord) {
      ({ solution: this.todayWord } = await this.ctx.http.get(
        `https://www.nytimes.com/svc/wordle/v2/${date ?? Time.template('yyyy-MM-dd')}.json`,
      ))
    }
    return this.todayWord
  }

  getRandomWord(): string {
    return Random.pick(require('./wordlist'))
  }

  validateInput(input: string, solution: string): WordleCore.Character[] {
    if (!input || input.length !== solution.length || !require('./wordlist').includes(input)) return

    const states: WordleCore.Character[] = []

    for (let i = 0; i < input.length; i++) {
      if (!solution.includes(input[i])) states.push({ char: input[i], stage: 'none' })
      else if (solution.indexOf(input[i]) !== i) states.push({ char: input[i], stage: 'wrong-place' })
      else states.push({ char: input[i], stage: 'correct' })
    }
    return states
  }
}

export namespace Wordle {
  export const name = 'koishi-plugin-wordle'
  export interface Config extends WordleCore.Config {}
  export const Config: Schema<Config> = Schema.object({
    imageMode: Schema.boolean().default(true),
  })
}

export default Wordle
