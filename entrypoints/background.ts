
import { storage } from '#imports'
export default defineBackground(() => {
  console.log('background is ready');
  browser.action.onClicked.addListener((tab) => {
    // 向当前活动标签页的内容脚本发送消息
    console.log('extension click')
    browser.tabs.sendMessage(tab.id!, { action: "toggleMocka" });
  });
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
