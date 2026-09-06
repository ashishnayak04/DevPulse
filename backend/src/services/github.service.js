const axios = require('axios');
const config = require('../config/env');
const HttpError = require('../lib/http-error');
const logger = require('../lib/logger');

const SCOPE = 'GitHubService';
const GITHUB_API = 'https://api.github.com';

function githubConfigured() {
  return Boolean(config.github?.token);
}

function githubHeaders() {
  return {
    Accept: config.github?.filePatch
      ? 'application/vnd.github+json'
      : 'application/vnd.github.raw+json, application/vnd.github+json',
    Authorization: `Bearer ${config.github.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function toHttpError(err, fallbackStatus = 500, fallbackCode = 'GITHUB_ERROR') {
  if (err instanceof HttpError) return err;

  const status = err?.response?.status || fallbackStatus;
  const message = err?.response?.data?.message || err?.message || 'GitHub API error';

  if (status === 401) {
    return new HttpError('GitHub token is invalid or expired', { statusCode: 401, code: 'GITHUB_UNAUTHORIZED' });
  }
  if (status === 403) {
    return new HttpError('GitHub request forbidden (token scope or rate limit)', { statusCode: 403, code: 'GITHUB_FORBIDDEN' });
  }
  if (status === 404) {
    return new HttpError('Repository or resource not found on GitHub', { statusCode: 404, code: 'GITHUB_NOT_FOUND' });
  }
  return new HttpError(message, { statusCode: status, code: fallbackCode });
}

async function validateRepository(owner, name) {
  if (!githubConfigured()) {
    throw new HttpError('GitHub is not configured (GITHUB_TOKEN missing)', {
      statusCode: 400,
      code: 'GITHUB_NOT_CONFIGURED',
    });
  }

  try {
    const { data } = await axios.get(`${GITHUB_API}/repos/${owner}/${name}`, {
      headers: githubHeaders(),
      timeout: 10000,
    });

    return {
      fullName: data.full_name,
      name: data.name,
      owner: data.owner.login,
      defaultBranch: data.default_branch || 'main',
      url: data.html_url,
      description: data.description,
    };
  } catch (err) {
    throw toHttpError(err, 400, 'GITHUB_INVALID_REPO');
  }
}

async function listRepositoryCommits({ owner, name, since, branch, perPage, max }) {
  if (!githubConfigured()) {
    throw new HttpError('GitHub is not configured (GITHUB_TOKEN missing)', {
      statusCode: 400,
      code: 'GITHUB_NOT_CONFIGURED',
    });
  }

  try {
    const pageSize = Math.min(perPage || config.github.perPage, 100);
    const { data } = await axios.get(`${GITHUB_API}/repos/${owner}/${name}/commits`, {
      headers: githubHeaders(),
      timeout: 15000,
      params: {
        sha: branch || undefined,
        ...(since ? { since: new Date(since).toISOString() } : {}),
        per_page: pageSize,
      },
    });

    return {
      commits: data.map((item) => ({
        sha: item.sha,
        message: item.commit?.message || '',
        author: item.commit?.author?.name || '',
        authorEmail: item.commit?.author?.email || null,
        authorDate: item.commit?.author?.date ? new Date(item.commit.author.date) : null,
        url: item.html_url || null,
      })),
      truncated: data.length >= pageSize && typeof max === 'number' ? data.length >= max : false,
    };
  } catch (err) {
    throw toHttpError(err, 500, 'GITHUB_FETCH_COMMITS_FAILED');
  }
}

async function getCommitDetail({ owner, name, sha }) {
  if (!githubConfigured()) {
    throw new HttpError('GitHub is not configured (GITHUB_TOKEN missing)', {
      statusCode: 400,
      code: 'GITHUB_NOT_CONFIGURED',
    });
  }

  try {
    const { data } = await axios.get(`${GITHUB_API}/repos/${owner}/${name}/commits/${sha}`, {
      headers: githubHeaders(),
      timeout: 15000,
    });

    return {
      sha: data.sha,
      message: data.commit?.message || '',
      author: data.commit?.author?.name || '',
      authorEmail: data.commit?.author?.email || null,
      authorDate: data.commit?.author?.date ? new Date(data.commit.author.date) : null,
      url: data.html_url || null,
      files: (data.files || []).map((file) => ({
        filename: file.filename,
        status: file.status || 'modified',
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        patch: config.github.filePatch && file.patch ? file.patch : null,
      })),
    };
  } catch (err) {
    throw toHttpError(err, 500, 'GITHUB_FETCH_COMMIT_FAILED');
  }
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 300;
const codeCache = new Map();

function cacheCode(key, value) {
  if (codeCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = codeCache.keys().next().value;
    if (oldest) codeCache.delete(oldest);
  }
  codeCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

async function getFileContent({ owner, name, path, ref }) {
  if (!githubConfigured()) {
    throw new HttpError('GitHub is not configured (GITHUB_TOKEN missing)', {
      statusCode: 400,
      code: 'GITHUB_NOT_CONFIGURED',
    });
  }

  if (!path) {
    throw new HttpError('File path is required', { statusCode: 400, code: 'GITHUB_INVALID_PATH' });
  }

  const cacheKey = `${owner}/${name}/${String(path).replace(/\\/g, '/')}@${ref || ''}`;
  const hit = codeCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return { ...hit.value, cached: true };
  }

  try {
    const { data } = await axios.get(
      `${GITHUB_API}/repos/${owner}/${name}/contents/${String(path).replace(/^\/+/, '')}`,
      {
        headers: githubHeaders(),
        timeout: 15000,
        params: ref ? { ref } : {},
      }
    );

    let content = null;
    if (data.content && data.encoding === 'base64') {
      content = Buffer.from(data.content, 'base64').toString('utf8');
    } else if (data.type === 'file' && typeof data.content !== 'string') {
      content = null;
    }

    const value = {
      path: data.path,
      type: data.type || 'file',
      sha: data.sha,
      size: data.size || 0,
      url: data.html_url || null,
      content,
      truncated: content === null || (content && content.length > 20000),
      cached: false,
    };
    cacheCode(cacheKey, value);
    return value;
  } catch (err) {
    throw toHttpError(err, 404, 'GITHUB_FETCH_FILE_FAILED');
  }
}

async function verifyHookSignature(rawBody, signature) {
  if (!config.github.hookSecret) {
    throw new HttpError('GitHub hook is not configured (GITHUB_HOOK_SECRET missing)', {
      statusCode: 400,
      code: 'GITHUB_HOOK_NOT_CONFIGURED',
    });
  }
  if (!signature) {
    throw new HttpError('Missing X-Hub-Signature-256 header', { statusCode: 401, code: 'GITHUB_HOOK_SIGNATURE_REQUIRED' });
  }

  const crypto = require('crypto');
  const expected = crypto.createHmac('sha256', config.github.hookSecret).update(rawBody).digest('hex');
  const received = String(signature).replace(/^sha256=/, '');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    logger.warn(SCOPE, 'GitHub hook signature mismatch');
    throw new HttpError('Invalid GitHub hook signature', { statusCode: 401, code: 'GITHUB_HOOK_INVALID_SIGNATURE' });
  }
}

module.exports = {
  githubConfigured,
  validateRepository,
  listRepositoryCommits,
  getCommitDetail,
  getFileContent,
  verifyHookSignature,
};