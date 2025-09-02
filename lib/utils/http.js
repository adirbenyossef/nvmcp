/**
 * @fileoverview Simple HTTP client utilities for NVMCP
 * @module http
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { NETWORK, TIME } = require('../constants');

/**
 * Make an HTTP request
 * @param {string} url - URL to request
 * @param {Object} [options={}] - Request options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {Object} [options.headers] - Request headers
 * @param {string} [options.data] - Request data
 * @param {number} [options.timeout] - Request timeout in milliseconds
 * @returns {Promise<Object>} Response object with statusCode, headers, and data
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? NETWORK.HTTP.SECURE_PORT : NETWORK.HTTP.DEFAULT_PORT),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': NETWORK.HTTP.USER_AGENT,
          'Accept': NETWORK.HTTP.HEADERS.ACCEPT,
          ...options.headers
        },
        timeout: options.timeout || TIME.DEFAULT_TIMEOUT
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const response = {
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            data: data
          };

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.data) {
        req.write(options.data);
      }

      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Make a GET request
 * @param {string} url - URL to request
 * @param {Object} [options={}] - Request options
 * @returns {Promise<Object>} Response object
 */
function get(url, options = {}) {
  return request(url, { ...options, method: 'GET' });
}

/**
 * Make a POST request
 * @param {string} url - URL to request
 * @param {*} data - Data to send (will be JSON stringified if object)
 * @param {Object} [options={}] - Request options
 * @returns {Promise<Object>} Response object
 */
function post(url, data, options = {}) {
  const headers = {
    'Content-Type': NETWORK.HTTP.HEADERS.CONTENT_TYPE,
    ...options.headers
  };
  const postData = typeof data === 'string' ? data : JSON.stringify(data);

  return request(url, {
    ...options,
    method: 'POST',
    headers,
    data: postData
  });
}

/**
 * Download a file from URL
 * @param {string} url - URL to download
 * @param {string} destination - Destination file path
 * @param {Object} [options={}] - Download options
 * @returns {Promise<Object>} Download result with destination, size, and contentType
 */
function downloadFile(url, destination, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'nvmcp/1.0.0',
        ...options.headers
      },
      timeout: options.timeout || TIME.DOWNLOAD_TIMEOUT
    };

    const req = client.request(requestOptions, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destination, options)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      // Ensure directory exists
      const dir = path.dirname(destination);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fileStream = fs.createWriteStream(destination);
      let downloadedBytes = 0;
      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (options.onProgress && totalBytes > 0) {
          options.onProgress(downloadedBytes, totalBytes);
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve({
          destination,
          size: downloadedBytes,
          contentType: res.headers['content-type']
        });
      });

      fileStream.on('error', (error) => {
        fs.unlink(destination, () => {});
        reject(error);
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timeout'));
    });

    req.end();
  });
}

/**
 * Fetch and parse JSON from URL
 * @param {string} url - URL to fetch
 * @param {Object} [options={}] - Request options
 * @returns {Promise<*>} Parsed JSON data
 */
async function fetchJson(url, options = {}) {
  try {
    const response = await get(url, options);
    return JSON.parse(response.data);
  } catch (error) {
    if (error.message.includes('Unexpected token')) {
      throw new Error('Invalid JSON response');
    }
    throw error;
  }
}

/**
 * Get npm package information
 * @param {string} packageName - Name of the npm package
 * @returns {Promise<Object>} Package information
 */
async function getNpmPackageInfo(packageName) {
  const registryUrl = `${NETWORK.REGISTRY.NPM_BASE_URL}/${encodeURIComponent(packageName)}`;

  try {
    const packageInfo = await fetchJson(registryUrl);
    const latestVersion = packageInfo['dist-tags']?.latest;

    if (!latestVersion) {
      throw new Error('No latest version found');
    }

    const versionInfo = packageInfo.versions[latestVersion];

    return {
      name: packageInfo.name,
      version: latestVersion,
      description: packageInfo.description,
      homepage: packageInfo.homepage,
      repository: packageInfo.repository,
      tarball: versionInfo.dist.tarball,
      dependencies: versionInfo.dependencies || {},
      engines: versionInfo.engines || {}
    };
  } catch (error) {
    throw new Error(`Failed to fetch npm package info: ${error.message}`);
  }
}

/**
 * Get GitHub repository information
 * @param {string} repoPath - Repository path (owner/repo)
 * @returns {Promise<Object>} Repository information
 */
async function getGithubRepoInfo(repoPath) {
  const [owner, repo] = repoPath.split('/');
  const apiUrl = `${NETWORK.REGISTRY.GITHUB_API_BASE}/repos/${owner}/${repo}`;

  try {
    const repoInfo = await fetchJson(apiUrl);

    return {
      name: repoInfo.name,
      full_name: repoInfo.full_name,
      description: repoInfo.description,
      clone_url: repoInfo.clone_url,
      default_branch: repoInfo.default_branch,
      tarball_url: `https://api.github.com/repos/${owner}/${repo}/tarball/${repoInfo.default_branch}`
    };
  } catch (error) {
    throw new Error(`Failed to fetch GitHub repo info: ${error.message}`);
  }
}

module.exports = {
  request,
  get,
  post,
  downloadFile,
  fetchJson,
  getNpmPackageInfo,
  getGithubRepoInfo
};

