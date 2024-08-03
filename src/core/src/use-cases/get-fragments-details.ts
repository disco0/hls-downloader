import { Fragment, Level } from "../entities";
import { ILoader, IParser } from "../services";

export const getFragmentsDetailsFactory = (
  loader: ILoader,
  parser: IParser,
) => {
  const run = async (
    playlist: Level,
    fetchAttempts: number,
    init?: Partial<RequestInit>
  ): Promise<Fragment[]> => {
    // console.debug(`fetch("%s")`, playlist.uri)
    const levelPlaylistText = await loader.fetchText(
      playlist.uri,
      fetchAttempts,
      init
    );
    const fragments = parser.parseLevelPlaylist(
      levelPlaylistText,
      playlist.uri,
    );
    return fragments;
  };
  return run;
};
