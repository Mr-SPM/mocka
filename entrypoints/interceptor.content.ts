// entrypoints/interceptor.content.ts
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN',
  async main() {
    console.log('🔍 Mocka interceptor loaded')

    // ========= 初始化阶段 =========
    const configReady = new Promise<any[]>((resolve) => {
      const listener = (event: MessageEvent) => {
        if (event.data?.type === 'MOCKA_CONFIG') {
          window.removeEventListener('message', listener)
          console.log(event.data.value);
          resolve(event.data.value)
        }
      }
      window.addEventListener('message', listener)
      // 向 bridge 请求配置
      // window.postMessage({ type: 'REQUEST_STORAGE' }, '*')
    })

    const res = await configReady
    const treeData = res?.[0]?.value;
    const enabled = res?.[1]?.value;
    console.log('[Mocka] 配置加载完成:', { treeData, enabled })
    if (treeData?.length > 0 && enabled) {

      const config = buildMockConfig(treeData, enabled)
      if (config) {
        const fetchInterceptor = createFetchInterceptor(config)
        const xhrInterceptor = createXHRInterceptor(config)

        console.log('✅ Mocka interceptors installed')
        fetchInterceptor.install()
        xhrInterceptor.install()
      }
    }
  },
})


// ========= 工具函数模块化 =========
function buildMockConfig(treeData: any[], enabled: boolean) {
  const mockData = treeData.reduce((acc, next) => {
    if (next.children && !next.disabled && next.domain === location.host) {
      for (const api of next.children) acc[api.title] = api.mockData
    }
    return acc
  }, {} as Record<string, any>)

  return { data: mockData, enabled }
}

// ========= 拦截 fetch =========
function createFetchInterceptor(config: { data: Record<string, any>, enabled: boolean }) {
  const originalFetch = window.fetch
  const matchPath = (req: string, mock: string) => {
    const r = req.startsWith('/') ? req : '/' + req
    const m = mock.startsWith('/') ? mock : '/' + mock
    if (r === m) return true
    const rParts = r.split('/')
    const mParts = m.split('/')
    return rParts.length === mParts.length && mParts.every((p, i) => p.startsWith(':') || p === rParts[i])
  }

  const findMock = (url: string) => {
    if (!config.enabled) return null
    const path = new URL(url, location.origin).pathname
    return Object.entries(config.data).find(([mockPath]) => matchPath(path, mockPath))?.[1] ?? null
  }

  return {
    install() {
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url)
        const mockData = findMock(url)
        if (mockData) {
          console.log(`🎯 Mocka intercept Fetch: ${url}`)
          await delay()
          return new Response(JSON.stringify(mockData), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Mocka-Intercepted': 'true' },
          })
        }
        return originalFetch.call(this, input, init)
      }
    }
  }
}

// ========= 拦截 XHR =========
function createXHRInterceptor(config: { data: Record<string, any>, enabled: boolean }) {
  const matchPath = (req: string, mock: string) => {
    const r = req.startsWith('/') ? req : '/' + req
    const m = mock.startsWith('/') ? mock : '/' + mock
    if (r === m) return true
    const rParts = r.split('/')
    const mParts = m.split('/')
    return rParts.length === mParts.length && mParts.every((p, i) => p.startsWith(':') || p === rParts[i])
  }
  const findMock = (url: string) => {
    if (!config.enabled) return null
    const path = new URL(url, location.origin).pathname
    return Object.entries(config.data).find(([mockPath]) => matchPath(path, mockPath))?.[1] ?? null
  }

  return {
    install() {
      const origOpen = XMLHttpRequest.prototype.open
      const origSend = XMLHttpRequest.prototype.send

      XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
        (this as any)._mockaUrl = url.toString()
        (this as any)._mockaMethod = method.toUpperCase()
        return origOpen.call(this, method, url, ...args)
      }

      XMLHttpRequest.prototype.send = function (body?: any) {
        const url = (this as any)._mockaUrl
        const mockData = findMock(url)
        if (mockData) {
          console.log(`🎯 Mocka intercept XHR: ${url}`)
          setTimeout(() => {
            Object.assign(this, {
              readyState: 4, status: 200, statusText: 'OK',
              responseText: JSON.stringify(mockData), response: JSON.stringify(mockData)
            })
            this.onreadystatechange?.(new Event('readystatechange'))
            this.onload?.(new Event('load'))
            this.onloadend?.(new Event('loadend'))
          }, Math.random() * 100 + 50)
          return
        }
        return origSend.call(this, body)
      }
    }
  }
}

function delay() {
  return new Promise(res => setTimeout(res, Math.random() * 100 + 50))
}
