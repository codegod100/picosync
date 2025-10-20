import { defineConfig } from '@rsbuild/core'
import { pluginSvelte } from '@rsbuild/plugin-svelte'

class IgnoreCapnwebWarningsPlugin {
  apply(compiler: any) {
    compiler.hooks.done.tap('IgnoreCapnwebWarningsPlugin', (stats: any) => {
      const compilation = stats?.compilation
      if (!compilation?.warnings) return
      compilation.warnings = compilation.warnings.filter(
        (warning: { message?: string }) =>
          !/capnweb\/dist\/index\.js/.test(warning?.message ?? ''),
      )
    })
  }
}

export default defineConfig({
  plugins: [pluginSvelte()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  tools: {
    rspack: config => {
      const ignore = config.ignoreWarnings
      const ignoreList = Array.isArray(ignore)
        ? ignore
        : ignore
          ? [ignore]
          : []
      config.ignoreWarnings = [...ignoreList, /capnweb\/dist\/index\.js/]

      const stats = config.stats ?? {}
      const existing = stats.warningsFilter
      const filters = Array.isArray(existing)
        ? existing
        : existing
          ? [existing]
          : []
      config.stats = {
        ...stats,
        warningsFilter: [...filters, /capnweb\/dist\/index\.js/],
      }

      const plugins = config.plugins ?? []
      config.plugins = [...plugins, new IgnoreCapnwebWarningsPlugin()]

      const currentModule = config.module ?? {}
      const currentParser = currentModule.parser ?? {}
      const currentJsParser = currentParser.javascript ?? {}
      config.module = {
        ...currentModule,
        parser: {
          ...currentParser,
          javascript: {
            ...currentJsParser,
            exprContextCritical: false,
          },
        },
      }
    },
  },
})
