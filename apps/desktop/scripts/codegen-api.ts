import { generateEndpoints, parseConfig } from '@rtk-query/codegen-openapi'

import config from '../rtk-codegen.config'

// The upstream CLI requires a second TypeScript loader; the workspace already runs scripts with tsx.
for (const output of parseConfig(config)) {
  await generateEndpoints(output)
}
