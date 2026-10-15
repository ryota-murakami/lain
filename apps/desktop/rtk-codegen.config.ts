import type { ConfigFile } from '@rtk-query/codegen-openapi'

const config: ConfigFile = {
  schemaFile: './raindrop-openapi-3.0.3.json',
  apiFile: './src/store/api/emptyApi.ts',
  outputFile: './src/store/api/raindropApi.ts',
  exportName: 'raindropApi',
  hooks: true,
  tag: true,
}

export default config
