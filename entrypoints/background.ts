// No background logic needed yet: dictionary/Wikimedia requests are made
// directly from the content script and manager/popup pages, which already
// have host_permissions for those domains.
export default defineBackground(() => {});
