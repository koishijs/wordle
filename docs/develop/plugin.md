# 开发插件

:::tip
由于 Wordle 插件及其核心 `@koishijs/wordle` 仍处于早期开发阶段，下述的内容可能会随着项目的进展而发生变化。
:::

## 创建新插件

首先应当按照 [Koishi 工作区开发](https://koishi.chat/zh-CN/guide/develop/workspace.html) 创建一个新的插件项目，然后在项目目录下安装 `@koishijs/wordle`：

:::tabs code
```npm
npm install @koishijs/wordle
```
```yarn
yarn add @koishijs/wordle
```
:::

然后进入 `src/index.ts`，你会发现 Koishi 的工具链已经为你写入了一些基本的代码。但由于 Wordle 插件的特殊性，我们应当将其替换为如下的形式：

```ts
import { defineVariation } from '@koishijs/wordle'
import { Schema } from 'koishi'

export interface Config {}

export default defineVariation<Config>({
  name: 'koishi-plugin-wordle', // 插件名称
  command: 'wordle',            // 插件指令
  Config: Schema.intersect([]) as Schema<Config>, // 插件配置
  locales: {
    'zh-CN': require('./locales/zh-CN'),
  },
  validWords: [], // 单词列表
  init(command, ctx) {
    // 初始化操作，如注册指令的选项等。
  },
  async getCurrentWord({ options, session }, { ctx, config }) {
    // 获取当天的单词
  },
})
```

## 关于插件的命名

插件的命名应当遵循 `koishi-plugin-xxx` 的格式，其中 `xxx` 为插件的名称。例如，`koishi-plugin-wordle` 为 Wordle 插件的名称。尽管插件通过 `@koishijs/wordle` 定义，但我们并不需要在插件前缀中包含 `wordle`，而应当根据你实现的游戏名称或者其规则来命名：

如 New York Times 版权所有的 `wordle` 游戏被认为是所有 wordle 类游戏的鼻祖，因此实现了该游戏规则的插件应当命名为 `koishi-plugin-wordle`。基于此规则，实现了[麻将立直牌型](https://github.com/yf-dev/mahjong-hand-guessing-game)的插件应当命名为 `koishi-plugin-mahjong-hand`，实现了[汉字成语](https://github.com/antfu/handle)的插件按照其名称命名为 `koishi-plugin-handle`。
