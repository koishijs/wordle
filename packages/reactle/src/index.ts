import { defineVariation } from '@koishijs/wordle'
import { Schema } from 'koishi'

import wordlist from './data/wordlist.json'

export interface Config {}

export default defineVariation<Config>({
  name: 'koishi-plugin-reactle',
  command: 'reactle',
  Config: Schema.intersect([]).i18n({
    'zh-CN': require('./locales/schema.zh-CN'),
  }) as Schema<Config>,
  locales: {
    'zh-CN': require('./locales/zh-CN'),
  },
  validWords: wordlist.map((word: string) => word.split('')),
  init(command) {
    command.option('random', '-r')
  },
  async getCurrentWord({ options }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((options as any).random) {
      return wordlist[Math.floor(Math.random() * wordlist.length)].split('')
    }
    // 1 January 2022 Game Epoch
    const daysSinceLaunch = (Number(new Date()) - Number(new Date(2022, 0))) / 1000 / 60 / 60 / 24
    return wordlist[Math.floor(daysSinceLaunch) % wordlist.length].split('')
  },
})

export interface NYTimesWordleResponse {
  id: number
  solution: string
  print_date: string
  days_since_launch: number
  editor: string
}
