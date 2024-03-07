import { defineVariation } from '@koishijs/wordle'
import { Schema } from 'koishi'

import wordlist from './data/wordlist.json'

export interface Config {
  fallbackToRandom: boolean
  timeout: number
}

function getRandomWord() {
  return wordlist[Math.floor(Math.random() * wordlist.length)]
}

export default defineVariation<Config>({
  name: 'koishi-plugin-wordle',
  command: 'wordle',
  Config: Schema.intersect([
    Schema.intersect([
      Schema.object({
        fallbackToRandom: Schema.boolean().default(true),
      }),
      Schema.union([
        Schema.object({
          fallbackToRandom: Schema.const(true),
          timeout: Schema.number().default(5000),
        }),
        Schema.object({
          fallbackToRandom: Schema.const(false),
        }),
      ]),
    ]),
  ]).i18n({
    'zh-CN': require('./locales/schema.zh-CN'),
  }) as Schema<Config>,
  locales: {
    'zh-CN': require('./locales/zh-CN'),
  },
  validWords: wordlist.map((word: string) => word.split('')),
  init(command, ctx) {
    command.option('random', '-r')
  },
  async getCurrentWord({ options, session }, { ctx, config }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((options as any).random) {
      return getRandomWord().split('')
    }
    // get today's wordle from New York Times
    const date = new Date().toISOString().slice(0, 10)
    try {
      const { solution } = await ctx.http.get<NYTimesWordleResponse>(
        `https://www.nytimes.com/svc/wordle/v2/${date}.json`,
        config.fallbackToRandom
          ? {
              // In case of network error, we fallback to a random word.
              timeout: config.timeout,
            }
          : {},
      )
      return solution.split('')
    } catch (err) {
      // NYTimes is not accessible in China and some other regions,
      // so we fallback to a random word.
      await session.send(session.text('.fallback-to-random'))
      return getRandomWord().split('')
    }
  },
})

export interface NYTimesWordleResponse {
  id: number
  solution: string
  print_date: string
  days_since_launch: number
  editor: string
}
