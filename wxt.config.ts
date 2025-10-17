
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Mocka',
    description: 'Mock API responses for development',
    permissions: ['activeTab', 'scripting', 'tabs', 'storage', 'webNavigation'],
    host_permissions: ['<all_urls>'],
    action: {},
  },
  publicDir: 'public'
});



