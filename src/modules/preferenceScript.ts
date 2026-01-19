import { config } from "../../package.json";

export async function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  // See addon/content/preferences.xhtml onpaneload
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
  bindPrefEvents();
}

function bindPrefEvents() {
  const doc = addon.data.prefs!.window.document;

  // API Key 输入框事件
  doc
    ?.querySelector(`#zotero-prefpane-${config.addonRef}-mineru-api-key`)
    ?.addEventListener("change", (e: Event) => {
      ztoolkit.log("MinerU API Key changed");
    });

  // API URL 输入框事件
  doc
    ?.querySelector(`#zotero-prefpane-${config.addonRef}-mineru-api-url`)
    ?.addEventListener("change", (e: Event) => {
      ztoolkit.log("MinerU API URL changed");
    });
}
