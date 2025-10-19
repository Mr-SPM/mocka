
// entrypoints/interceptor.content.ts - 纯浏览器拦截器（不使用 Service Worker）
import { STORAGE_KEY, MOCK_ENABLED_KEY } from '../utils'
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    console.log('🔍 Mocka interceptor loaded');

    const treeData: any[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    let mockData: unknown;

    function isEnableInThisDomain() {
      return treeData.some((item: any) => item.domain === location.hostname && !item.disabled)
    }

    if (!isEnableInThisDomain()) {
      return
    }

    // 获取本地存储数据
    const getMockConfig = () => {
      try {
        const enabled = localStorage.getItem(MOCK_ENABLED_KEY);
        if (!mockData) {

          // 筛选可用的接口
          let mockData = treeData.reduce((acc, next) => {
            if (next.children && !next.disabled && next.domain === location.hostname) {
              for (const api of next.children) {
                acc[api.title] = api.mockData
              }
            }
          }, {} as Record<string, any>)
          return {
            data: mockData,
            enabled: enabled !== 'false', // 默认启用
          };
        }
        return {
          data: mockData,
          enabled: enabled !== 'false',
        }
      } catch {
        return { data: {}, enabled: true };
      }
    };

    // 路径匹配函数
    const matchPath = (requestPath: string, mockPath: string): boolean => {
      // 确保路径以 / 开头
      const normRequestPath = requestPath.startsWith('/') ? requestPath : '/' + requestPath;
      const normMockPath = mockPath.startsWith('/') ? mockPath : '/' + mockPath;

      // 精确匹配
      if (normRequestPath === normMockPath) return true;

      // 参数匹配 (/api/user/:id 匹配 /api/user/123)
      const mockParts = normMockPath.split('/');
      const requestParts = normRequestPath.split('/');

      if (mockParts.length !== requestParts.length) return false;

      return mockParts.every((part, index) => {
        return part.startsWith(':') || part === requestParts[index];
      });
    };

    // 查找匹配的 mock 数据
    const findMockData = (url: string, method: string = 'GET') => {
      const { data, enabled } = getMockConfig();

      if (!enabled) return null;

      // 获取路径部分
      const getPath = (fullUrl: string) => {
        try {
          return new URL(fullUrl).pathname;
        } catch {
          return fullUrl.startsWith('/') ? fullUrl : '/' + fullUrl;
        }
      };

      const requestPath = getPath(url);

      for (const [key, mockData] of Object.entries(data)) {
        if (key.startsWith('api:')) {
          const apiPath = key.replace('api:', '');
          if (matchPath(requestPath, apiPath)) {
            return mockData;
          }
        }
      }
      return null;
    };

    // 拦截 fetch
    const originalFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
      const method = init?.method || 'GET';

      const mockData = findMockData(url, method);
      if (mockData) {
        console.log(`🎯 Mocka intercepted Fetch ${method}:`, url);

        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

        return new Response(JSON.stringify(mockData), {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
            'X-Mocka-Intercepted': 'true'
          }
        });
      }

      return originalFetch.call(this, input, init);
    };

    // 拦截 XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
      (this as any)._mockaUrl = url.toString();
      (this as any)._mockaMethod = method.toUpperCase();
      return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function (body?: any) {
      const url = (this as any)._mockaUrl;
      const method = (this as any)._mockaMethod;
      const mockData = findMockData(url, method);

      if (mockData) {
        console.log(`🎯 Mocka intercepted XHR ${method}:`, url);

        // 模拟异步响应
        setTimeout(() => {
          Object.defineProperty(this, 'readyState', { value: 4, writable: true, configurable: true });
          Object.defineProperty(this, 'status', { value: 200, writable: true, configurable: true });
          Object.defineProperty(this, 'statusText', { value: 'OK', writable: true, configurable: true });

          const responseText = JSON.stringify(mockData);
          Object.defineProperty(this, 'responseText', { value: responseText, writable: true, configurable: true });
          Object.defineProperty(this, 'response', { value: responseText, writable: true, configurable: true });

          this.getResponseHeader = function (name: string) {
            const headers: Record<string, string> = {
              'content-type': 'application/json',
              'x-mocka-intercepted': 'true'
            };
            return headers[name.toLowerCase()] || null;
          };

          this.getAllResponseHeaders = function () {
            return 'content-type: application/json\r\nx-mocka-intercepted: true';
          };

          // 触发事件
          if (this.onreadystatechange) {
            this.onreadystatechange(new Event('readystatechange'));
          }
          if (this.onload) {
            this.onload(new Event('load'));
          }
          if (this.onloadend) {
            this.onloadend(new Event('loadend'));
          }
        }, Math.random() * 100 + 50);

        return;
      }

      return originalXHRSend.call(this, body);
    };

    console.log('✅ Mocka: Fetch and XHR interceptors installed');

    // 初始化
    const initMocka = () => {
      const { data, enabled } = getMockConfig();

      const apiCount = Object.keys(data).filter(k => k.startsWith('api:')).length;

      console.log(`� Mocka: ${enabled ? 'Enabled' : 'Disabled'}, ${apiCount} APIs configured`);
      updateIndicator();
    };

    // 监听存储变化
    window.addEventListener('storage', (e) => {
      if (e.key === MOCK_DATA_KEY || e.key === MOCK_ENABLED_KEY) {
        console.log('🔄 Mocka: Storage changed, reloading config');
        initMocka();
      }
    });

    // 页面指示器
    let indicator: HTMLElement | null = null;

    const updateIndicator = () => {
      const { enabled } = getMockConfig();
      const hasData = Object.keys(getMockConfig().data || {}).length > 0;

      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'mocka-indicator';
        indicator.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          cursor: pointer;
          user-select: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          backdrop-filter: blur(10px);
        `;

        // 点击切换启用状态
        indicator.addEventListener('click', () => {
          const { enabled } = getMockConfig();
          const newEnabled = !enabled;
          localStorage.setItem(MOCK_ENABLED_KEY, newEnabled.toString());
          initMocka();
        });

        // // 等待 DOM 准备好再添加
        // const addToDOM = () => {
        //   if (document.body && !document.getElementById('mocka-indicator')) {
        //     document.body.appendChild(indicator);
        //   }
        // };

        // if (document.body) {
        //   addToDOM();
        // } else {
        //   document.addEventListener('DOMContentLoaded', addToDOM);
        // }
      }

      if (indicator) {
        if (!enabled) {
          indicator.textContent = '🔴 Mocka 已禁用';
          indicator.style.background = 'rgba(255, 77, 79, 0.9)';
          indicator.style.color = 'white';
        } else if (!hasData) {
          indicator.textContent = '⚪ Mocka 无数据';
          indicator.style.background = 'rgba(128, 128, 128, 0.9)';
          indicator.style.color = 'white';
        } else {
          indicator.textContent = '🟢 Mocka 运行中';
          indicator.style.background = 'rgba(82, 196, 26, 0.9)';
          indicator.style.color = 'white';
        }
      }
    };

    // 启动
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMocka);
    } else {
      initMocka();
    }
  }
});



