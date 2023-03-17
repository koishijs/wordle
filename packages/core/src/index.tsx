import { Context, Element } from 'koishi'
import { } from 'koishi-plugin-puppeteer'

// A helper function to mimic the behaviour of `styled-components`.
// So we could use VSCode extension `vscode-styled-components` to
// highlight our CSS code.
const css = (args: TemplateStringsArray, ...values: any[]) => String.raw({ raw: args }, ...values)

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

export abstract class WordleCore<T extends WordleCore.Character = WordleCore.Character> {
  protected todayWord: string

  constructor(protected ctx: Context, protected config: WordleCore.Config) {
    ctx.i18n.define('zh', require('./locales/zh-CN'))
  }

  abstract getTodayWord(): Promise<string>
  async validateInput(input: string, solution: string): Promise<T[]> {
    return input.split('').map((c, i) => {
      const char: T = { char: c }
      if (c === solution[i]) {
        char.stage = 'correct'
      } else if (solution.includes(c)) {
        char.stage = 'wrong-place'
      } else {
        char.stage = 'none'
      }
      return char
    })
  }

  abstract getRandomWord(): string
  public render(chars: T[][]): Element {
    const textMode = !(this.config.imageMode && this.ctx.puppeteer)
    const elements: Element[] = chars.map(r => {
      const row = r.map(c => {
        if (!c && textMode) return ''
        if (textMode) return transformers[c?.stage](c?.char.toUpperCase())
        return <span class='cell' style={{ ...generateColor(c?.stage) }}> {c?.char} </span>
      })
      if (textMode) return <p>{row.join('')}</p>
      return <p class='row'>{row}</p>
    })

    if (textMode) return <>{elements}</>

    return (
      <html>
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
    )
  }
}

export namespace WordleCore {
  export type BaseState = 'none' | 'wrong-place' | 'correct'
  export interface Character<Stage extends BaseState = BaseState> {
    char: string
    stage?: Stage
  }

  export interface Config {
    imageMode: boolean
  }

  export type Transformer<O = string> = (word: string) => O
  export type Transformers = Record<WordleCore.BaseState, WordleCore.Transformer>
}
