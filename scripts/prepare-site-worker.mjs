import { cp, mkdir } from 'node:fs/promises'

await mkdir('dist/server', { recursive: true })
await cp('server/index.js', 'dist/server/index.js')

