import { Context, Element } from 'koishi'
import {} from 'koishi-plugin-puppeteer'

// A helper function to mimic the behaviour of `styled-components`.
// So we could use VSCode extension `vscode-styled-components` to
// highlight our CSS code.
const css = (args: TemplateStringsArray) => args.join('')

export function generateColor(color: WordleCore.BaseState): Partial<CSSStyleDeclaration> {
  const base = {
    color: '#fff',
    border: '2px solid transparent',
  }
  switch (color) {
    case 'correct':
      return { ...base, backgroundColor: '#79b851' }
    case 'wrong-place':
      return { ...base, backgroundColor: '#f3c237' }
    case 'none':
      return { ...base, backgroundColor: '#a4aec4' }
  }
}

const transformers: WordleCore.Transformers = {
  'correct': (word) => `[${word}]`,
  'wrong-place': (word) => `(${word})`,
  'none': (word) => ` ${word} `,
}

export abstract class WordleCore {
  constructor(protected ctx: Context, protected config: WordleCore.Config) {
    ctx.i18n.define('zh', require('./locales/zh-CN'))
  }

  abstract getTodayWord(): string
  abstract validateInput(input: WordleCore.Character): boolean
  public render(chars: WordleCore.Character[][]): Element {
    const textMode = !(this.config.imageMode && this.ctx.puppeteer)
    const elements: Element[] = chars.map(r => {
      const row = r.map(c => {
        if (textMode) return transformers[c?.stage]
        return <span class='cell' style={{ ...generateColor(c?.stage) }}> {c?.char} </span>
      })
      if (textMode) return row
      return <p class='row'>{row}</p>
    })
    if (textMode) {
      return <>
      <i18n path='wordle.core.wordle' />
      {elements}
      <i18n path='wordle.core.text-mode-hint' />
    </>
    }
    return <html>
      <div id='game'>{elements}</div>
      <style>{css`
        #game {
          display: flex;
          flex-direction: column;
          align-items: center;
          font-weight: 700;
        }

        #game .row {
          display: flex;
          margin: 0;
        }

        #game .cell {
          width: 44px;
          height: 44px;
          font-size: 20px;
          border: 2px solid #dee1e9;
          margin: 3px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 2px;
          text-transform: uppercase;
        }
      `}</style>
    </html>
  }
}

export namespace WordleCore {
  export type BaseState = 'none' | 'wrong-place' | 'correct'
  export interface Character<Stage = WordleCore.BaseState> {
    char: string
    stage?: Stage
  }

  export interface Config {
    imageMode: boolean
  }

  export type Transformer<O = string> = (word: string) => O
  export type Transformers = Record<WordleCore.BaseState, WordleCore.Transformer>
}
