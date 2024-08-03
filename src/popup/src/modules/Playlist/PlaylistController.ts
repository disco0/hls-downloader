import { Level, PlaylistStatus } from "@hls-downloader/core/lib/entities";
import type { RootState } from "@hls-downloader/core/lib/store/root-reducer";
import { levelsSlice } from "@hls-downloader/core/lib/store/slices";
import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RouterContext } from "../Navbar/RouterContext";
import { TabOptions } from "../Navbar/types";

interface ReturnType {
  status: PlaylistStatus | null;
  levels: Level[];
  downloadLevel: (levelId: string) => void;
}

const usePlaylistController = ({ id }: { id: string }): ReturnType => {
  const { setTab } = useContext(RouterContext);

  const dispatch = useDispatch();

  const status = useSelector<RootState, PlaylistStatus | null>(
    (state) => state.playlists.playlistsStatus[id],
  );
  const levels = useSelector<RootState, Level[]>((state) => {
    const list = Object.values(state.levels.levels)
      .flatMap((f) => (f ? [f] : []))
      .filter((l) => l?.playlistID === id);

    list.sort((a, b) => b?.bitrate! - a?.bitrate!);

    return list;
  });

  function downloadLevel(levelId: string) {
    dispatch(levelsSlice.actions.download({ levelID: levelId }));
    setTab(TabOptions.DOWNLOADS);
  }
  return {
    status,
    levels,
    downloadLevel,
  };
};

export default usePlaylistController;
