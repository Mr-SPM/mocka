export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_start',
    world: 'ISOLATED',
    async main() {
        const value = await Promise.all([chrome.runtime.sendMessage({
            type: 'getItem',
            key: STORAGE_KEY,
        }), chrome.runtime.sendMessage({
            type: 'getItem',
            key: MOCK_ENABLED_KEY,
        })]);
        window.postMessage({ type: 'MOCKA_CONFIG', value }, '*');
        //     window.addEventListener('message', async (event) => {
        //         if (event.data.type === 'REQUEST_STORAGE') {

        //         }
        //     });
        // },
    }
});