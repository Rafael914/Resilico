import { readFile } from 'node:fs/promises'
import path from 'node:path'

const contentTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  const extension = path.extname(filename).toLowerCase()
  if (path.basename(filename) !== filename || !contentTypes[extension]) {
    return new Response('Not found.', { status: 404 })
  }

  try {
    const image = await readFile(path.join(process.cwd(), 'public', 'product-images', filename))
    return new Response(image, {
      headers: {
        'Content-Type': contentTypes[extension],
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return new Response('Not found.', { status: 404 })
  }
}
