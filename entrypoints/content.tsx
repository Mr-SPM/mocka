
import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { type AppRef } from './content/App';

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    console.log('🟢 Mocka content script loaded');
    // 创建 React 根容器
    const container = document.createElement('div');
    container.id = 'mocka-extension-root';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483647;
    `;
    document.body.appendChild(container);

    // 渲染 React 应用
    const root = ReactDOM.createRoot(container);
    const appRef = React.createRef<AppRef>();
    
    root.render(<App ref={appRef} />);

    // 监听来自 background script 的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Content script received message:', message);
      
      if (message.action === 'toggleMocka' && appRef.current) {
        appRef.current.toggleOpen();
        sendResponse({ success: true });
      }
    });

    // MSW 拦截器会处理页面指示器
    console.log('🎯 Mocka Content Script Ready - MSW will handle interception');
  }
});


