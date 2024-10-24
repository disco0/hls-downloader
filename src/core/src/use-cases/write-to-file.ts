import type { IFS, MarkedURLString } from "../services";

export const saveAsFactory = (fs: IFS) => {
  const run = async (
    path: string,
    link: string,
    options: { dialog: boolean, extension?: string },
  ): Promise<void> => {
    if(!!options.extension)
    {
      path = path.replace(/[^.]+$/, options.extension)
    }
    await fs.saveAs(path, link, options);
  };
  return run;
};
