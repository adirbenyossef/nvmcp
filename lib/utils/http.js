const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'nvmcp/1.0.0',
          'Accept': 'application/json, */*',
          ...options.headers
        },
        timeout: options.timeout || 30000
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

function get(url, options = {}) {
  return request(url, { ...options, method: 'GET' });
}

function post(url, data, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const postData = typeof data === 'string' ? data : JSON.stringify(data);
  
  return request(url, {
    ...options,
    method: 'POST',
    headers,
    data: postData
  });
}

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
      timeout: options.timeout || 60000
    };
    
    const req = client.request(requestOptions, (res) => {
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

async function getNpmPackageInfo(packageName) {
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  
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

async function getGithubRepoInfo(repoPath) {
  const [owner, repo] = repoPath.split('/');
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
  
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