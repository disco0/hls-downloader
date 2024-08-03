import { createStore } from "@hls-downloader/core/lib/store/configure-store";
import { playlistsSlice } from "@hls-downloader/core/lib/store/slices";
import {
  webRequest,
  tabs,
  browserAction as actiobV2,
  action as actiobV3,
} from "webextension-polyfill";

export function addPlaylistListener(store: ReturnType<typeof createStore>) {
  webRequest.onResponseStarted.addListener(
    async (details) => {
      if (details.tabId < 0) {
        return;
      }
      const tab = await tabs.get(details.tabId);
      const action = actiobV2 || actiobV3;
      await action.setIcon({
        tabId: tab.id,
        path: {
          "16": "assets/icons/16-new.png",
          "48": "assets/icons/48-new.png",
          "128": "assets/icons/128-new.png",
          "256": "assets/icons/256-new.png",
        },
      });
      console.dir({...details})
      const initiator = details.initiator // details.frameId === 0 ? tab.url : details.documentUrl ?? tab.url
      console.log('details.documentUrl: %s', details.documentUrl)
      console.log('details.url: %s', details.url)
      console.log('initiator: %s', initiator)
      store.dispatch(
        playlistsSlice.actions.addPlaylist({
          id: details.url,
          uri: details.url,
          initiator,
          pageTitle: tab.title,
          createdAt: Date.now(),
          tabId: tab.id,
        //   documentUrl: details.frameId !== 0 ? details.documentUrl : undefined,
        })
      );
    },
    {
      types: ["xmlhttprequest"],
      urls: [
        "http://*/*.m3u8",
        "https://*/*.m3u8",
        "http://*/*.m3u8?*",
        "https://*/*.m3u8?*",
      ],
    }
  );
}
