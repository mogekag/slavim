import ReactDOM from 'react-dom/client';
import HighlightPopup from '@/components/HighlightPopup';
import '@/assets/highlight-popup.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'lexi-recall-popup',
      position: 'modal',
      zIndex: 2147483647,
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(<HighlightPopup />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
  },
});
