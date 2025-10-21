
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Mocka',
    description: 'Mock API responses for development',
    permissions: ['activeTab', 'scripting', 'tabs', 'storage', 'webNavigation', "declarativeNetRequest",
      "declarativeNetRequestFeedback"],
    host_permissions: [
      '*://*/*', // 或根据需要指定更具体的域名
      // ... 其他主机权限
    ],
    action: {},
  },
  publicDir: 'public',

});



