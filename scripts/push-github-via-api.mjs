/**
 * Push local master to GitHub via REST Git Data API when git push to github.com:443 fails.
 * Usage: GITHUB_TOKEN=ghp_xxx node scripts/push-github-via-api.mjs [tag]
 */
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const owner = 'qq1171910065'
const repo = 'manong-arena'
const branch = 'master'
const token = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim()
const tag = process.argv[2] || ''

if (!token) {
  throw new Error('Missing GITHUB_TOKEN or GH_TOKEN')
}

const apiBase = `https://api.github.com/repos/${owner}/${repo}`

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`)
  }
  return res.status === 204 ? null : res.json()
}

function git(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim()
}

function isBinary(buffer) {
  return buffer.includes(0)
}

async function createBlob(filePath) {
  const buffer = readFileSync(join(root, filePath))
  if (isBinary(buffer)) {
    const content = buffer.toString('base64')
    return api('/git/blobs', {
      method: 'POST',
      body: { content, encoding: 'base64' },
    })
  }
  return api('/git/blobs', {
    method: 'POST',
    body: { content: buffer.toString('utf8'), encoding: 'utf-8' },
  })
}

async function main() {
  const remoteSha = (await api(`/git/ref/heads/${branch}`)).object.sha
  const localSha = git('git rev-parse HEAD')
  const mergeBase = git(`git merge-base ${remoteSha} ${localSha}`)

  if (remoteSha === localSha) {
    console.log('[push-github-via-api] remote already up to date')
  } else if (mergeBase !== remoteSha) {
    throw new Error(
      `Remote ${branch} diverged (remote=${remoteSha.slice(0, 7)}, merge-base=${mergeBase.slice(0, 7)}). Resolve manually.`
    )
  }

  const diffLines = git(`git diff --name-status ${remoteSha}..${localSha}`).split('\n').filter(Boolean)
  if (!diffLines.length && remoteSha === localSha) {
    if (!tag) return
  } else if (!diffLines.length) {
    console.log('[push-github-via-api] no file changes to push')
  }

  console.log(`[push-github-via-api] remote=${remoteSha.slice(0, 7)} local=${localSha.slice(0, 7)} files=${diffLines.length}`)

  const { tree: baseTree } = await api(`/git/commits/${remoteSha}`)
  const entries = []
  let processed = 0

  for (const line of diffLines) {
    const tab = line.indexOf('\t')
    const status = line.slice(0, tab)
    let filePath = line.slice(tab + 1)
    if (status.startsWith('R')) {
      const parts = filePath.split('\t')
      filePath = parts[1] || parts[0]
      if (parts[0] && parts[0] !== parts[1]) {
        entries.push({ path: parts[0], mode: '100644', sha: null })
      }
    }
    if (status.startsWith('D')) {
      entries.push({ path: filePath, mode: '100644', sha: null })
      continue
    }
    const blob = await createBlob(filePath)
    entries.push({ path: filePath, mode: '100644', sha: blob.sha })
    processed += 1
    if (processed % 10 === 0) {
      console.log(`[push-github-via-api] blobs ${processed}/${diffLines.length}`)
    }
  }

  const { sha: newTreeSha } = await api('/git/trees', {
    method: 'POST',
    body: {
      base_tree: baseTree.sha,
      tree: entries.map((entry) => {
        if (!entry.sha) {
          return { path: entry.path, mode: entry.mode, sha: null }
        }
        return { path: entry.path, mode: entry.mode, type: 'blob', sha: entry.sha }
      }),
    },
  })

  const localMessage = git('git log -1 --format=%B')
  const { sha: commitSha } = await api('/git/commits', {
    method: 'POST',
    body: {
      message: localMessage,
      tree: newTreeSha,
      parents: [remoteSha],
    },
  })

  await api(`/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: { sha: commitSha, force: false },
  })

  console.log(`[push-github-via-api] updated ${branch} -> ${commitSha.slice(0, 7)}`)

  if (tag) {
    const tagName = tag.startsWith('v') ? tag : `v${tag}`
    try {
      await api(`/git/refs/tags/${tagName}`, { method: 'DELETE' })
    } catch {
      /* tag may not exist */
    }
    await api('/git/refs', {
      method: 'POST',
      body: { ref: `refs/tags/${tagName}`, sha: commitSha },
    })
    console.log(`[push-github-via-api] created tag ${tagName}`)
  }
}

await main()
