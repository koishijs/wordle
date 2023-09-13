import { defineVariation } from '@koishijs/wordle'

export default defineVariation({
  name: 'koishi-plugin-wordle',
  command: 'wordle',
  possibleUnitResults: ['partially-correct'] as const,
  init(command, ctx) {},
  handleInput(input, session, ctx) {
    return []
  },
})
