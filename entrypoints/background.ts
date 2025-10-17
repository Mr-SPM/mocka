
export default defineBackground(() => {
  console.log('background is ready');
browser.action.onClicked.addListener((tab) => {
  // 向当前活动标签页的内容脚本发送消息
  console.log('extension click')
  browser.tabs.sendMessage(tab.id!, { action: "toggleMocka" });
});
});
