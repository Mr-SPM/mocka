
import { storage } from '#imports'
export default defineBackground(() => {
  console.log('background is ready');
  browser.action.onClicked.addListener((tab) => {
    // 向当前活动标签页的内容脚本发送消息
    console.log('extension click')
    browser.tabs.sendMessage(tab.id!, { action: "toggleMocka" });
  });

  // 哈希函数：将 URL 字符串转换为哈希值
  function generateHash(url: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(url);
    return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer)); // 转为字节数组
      const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

      // 获取哈希的前 8 字节并转为一个 32 位无符号整数
      const hashInt = parseInt(hashHex.slice(0, 8), 16) >>> 0; // >>> 0 保证返回一个 32 位无符号整数
      return hashInt;
    });
  }

  // 更新规则函数
  async function updateRules(mockData: any) {
    const rules: any[] = [];

    let index = 1
    // 遍历 mockData 并生成规则
    for (const [url, data] of Object.entries(mockData)) {
      const jsonData = JSON.stringify(data);
      const base64Data = btoa(jsonData); // 将 mockData 转为 Base64 编码

      const redirectUrl = `data:application/json;base64,${base64Data}`;

      // 生成 URL 的哈希值作为规则 ID
      const hash = await generateHash(url);

      const rule = {
        id: index++,  // 使用哈希值作为唯一的规则 ID
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: redirectUrl }
        },
        condition: {
          urlFilter: `*://${url}*`, // 使用 URL 作为过滤条件
          resourceTypes: ["xmlhttprequest"]
        }
      };

      rules.push(rule);
    }

    console.log('更新规则', rules);
    // 更新 DNR 规则
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules,
      removeRuleIds: rules.map(rule => rule.id) // 删除旧规则
    });
  }
  // 监听 storage 变化并更新规则
  storage.watch(STORAGE_KEY, (v) => {
    const data = (v || []) as any[]
    const mockData = data.reduce((acc, next) => {
      if (next.children && !next.disabled) {
        for (const api of next.children) {
          acc[`${next.domain}${api.title}`] = api.mockData
        }
      }
      return acc
    }, {} as Record<string, any>)
    updateRules(mockData)
  })

  // 如果需要在开发调试时，监控请求，可以添加一些调试输出
  // chrome.webRequest.onBeforeRequest.addListener(
  //   (details) => {
  //     console.log('Intercepted Request:', details.url);
  //   },
  //   { urls: ['<all_urls>'] }
  // );
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      try {
        if (msg.type === 'getItem') {
          const v = await storage.getItem(msg.key);
          sendResponse({ ok: true, value: v });
        } else if (msg.type === 'setItem') {
          await storage.setItem(msg.key, msg.value);
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: 'unknown' });
        }
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true; // 表示异步 sendResponse
  });
});
