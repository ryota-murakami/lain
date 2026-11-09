import type { ConfigFile } from '@rtk-query/codegen-openapi'

const config: ConfigFile = {
  schemaFile: './raindrop-openapi-3.0.3.json',
  apiFile: './src/store/api/emptyApi.ts',
  outputFile: './src/store/api/raindropApi.ts',
  exportName: 'raindropApi',
  hooks: true,
  tag: true,
  // Mutations change related counts and metadata as well as their own endpoint family.
  endpointOverrides: [
    {
      pattern: /^(post|put|delete)Collections?/,
      invalidatesTags: ['collections', 'user', 'raindrops', 'tags'],
    },
    {
      pattern: /^(post|put|delete)Raindrops?/,
      invalidatesTags: ['raindrops', 'collections', 'tags', 'filters'],
    },
    {
      pattern: /^(put|delete)Tags/,
      invalidatesTags: ['tags', 'raindrops', 'filters'],
    },
  ],
}

export default config
