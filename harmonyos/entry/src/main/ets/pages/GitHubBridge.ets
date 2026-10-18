import http from '@ohos.net.http';
import webview from '@ohos.web.webview';
interface TreeEntry { path: string; mode: string; type: string; sha: string; }
interface TreeUpdate { base_tree: string; tree: TreeEntry[]; }
interface RefUpdate { sha: string; force: boolean; }
// Fixed repository. Never accept a URL or authentication header from page content.
export class GitHubBridge {
  private token: string = '';
  private generation: number = 0;
  private active: http.HttpRequest | null = null;
  private controller: webview.WebviewController;
  constructor(controller: webview.WebviewController) { this.controller = controller; }
  setSession(token: string): void {
    this.clearSession();
    if (/^[A-Za-z0-9_]{20,255}$/.test(token)) this.token = token;
  }
  clearSession(): void {
    this.token = '';
    this.generation++;
    if (this.active) { this.active.destroy(); this.active = null; }
  }
  request(id: number, method: string, path: string, body: string): void {
    this.perform(id, method, path, body);
  }
  private async perform(id: number, method: string, path: string, body: string): Promise<void> {
    if (!Number.isSafeInteger(id) || id < 1) return;
    const started = this.generation;
    let status = 0;
    let result = '';
    let req: http.HttpRequest | null = null;
    try {
      if (!this.token || this.active || body.length > 1500000) throw new Error('Session unavailable');
      const read = method === 'GET' && /^(ref\/heads\/main|commits\/[a-f0-9]{40}|trees\/[a-f0-9]{40}\?recursive=1|blobs\/[a-f0-9]{40})$/.test(path);
      const create = method === 'POST' && /^(blobs|trees|commits)$/.test(path);
      const update = method === 'PATCH' && path === 'refs/heads/main';
      if (!read && !create && !update) throw new Error('Operation refused');
      if (method === 'POST' && path === 'trees') {
        const value = JSON.parse(body) as TreeUpdate;
        if (!/^[a-f0-9]{40}$/.test(value.base_tree) || !Array.isArray(value.tree) || value.tree.length !== 1) throw new Error('Tree refused');
        const item = value.tree[0];
        if (typeof item.path !== 'string' || item.path.length > 1024 || !item.path.endsWith('.gpg') || item.mode !== '100644' || item.type !== 'blob' || !/^[a-f0-9]{40}$/.test(item.sha)) throw new Error('Credential path required');
        for (const component of item.path.split('/')) {
          if (!component || component === '.' || component === '..' || /[\x00-\x1f\\]/.test(component)) throw new Error('Path refused');
        }
      }
      if (update) {
        const value = JSON.parse(body) as RefUpdate;
        if (value.force !== false || !/^[a-f0-9]{40}$/.test(value.sha)) throw new Error('Force update refused');
      }
      req = http.createHttp(); this.active = req;
      const response = await req.request('https://api.github.com/repos/jonathanwilner/passless-store/git/' + path, {
        method: method === 'GET' ? http.RequestMethod.GET : http.RequestMethod.POST,
        customMethod: method,
        header: { 'Authorization': 'Bearer ' + this.token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Passless-HarmonyOS' },
        extraData: body,
        expectDataType: http.HttpDataType.STRING,
        usingCache: false,
        maxRedirects: 0,
        maxLimit: 4194304,
        connectTimeout: 15000,
        readTimeout: 30000
      });
      status = response.responseCode;
      if (status >= 200 && status < 300 && typeof response.result === 'string') result = response.result;
    } catch { status = 0; }
    finally { if (req) req.destroy(); if (this.active === req) this.active = null; }
    if (started !== this.generation) return;
    this.controller.runJavaScript(`window.passlessGitResponse(${id},${status},${JSON.stringify(result)})`).catch(() => {});
  }
}
