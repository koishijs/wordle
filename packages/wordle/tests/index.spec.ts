import memory from '@koishijs/plugin-database-memory'
import mock from '@koishijs/plugin-mock'
import { App } from 'koishi'

import * as wordle from '../src'

describe('wordle', () => {
  const app = new App()

  app.plugin(mock)
  app.plugin(memory)
  app.plugin(wordle)

  const client = app.mock.client('123')

  before(() => app.start())
  after(() => app.stop())

  it('get today wordle', async () => {
    await client.shouldReply('wordle')
  })
})
