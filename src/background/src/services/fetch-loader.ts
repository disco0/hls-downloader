type FetchFn<Data> = () => Promise<Data>;

async function fetchWithRetry<Data>(
  fetchFn: FetchFn<Data>,
  attempts: number = 1,
): Promise<Data> {
  if (attempts < 1) {
    throw new Error("Attempts less then 1");
  }
  let countdown = attempts;
  let retryTime = 100;
  while (countdown--) {
    try {
      return await fetchFn();
    } catch (e) {
      if (countdown < 1 && countdown < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryTime));
        retryTime *= 1.15;
      }
    }
  }
  throw new Error("Fetch error");
}

const toHeadersTuple = (headers: HeadersInit = [ ]): [string, string][] =>
    Array.isArray(headers)
        ? [ ...headers ] :
    headers instanceof Headers
        // @ts-expect-error
        ? [...headers.entries()] :
    // Record<string, string>
    [...Object.entries(headers)]

export async function fetchText(url: string, attempts: number = 1, init?: Partial<RequestInit>)
{
    const fetchFn: FetchFn<string> = () => (
        (init ? console.log(`fetch("%s", %o)\nHeaders: %o`, url, init, toHeadersTuple(init.headers)) : void 0),
        fetch(url, init).then((res) => res.text())
    );
    return fetchWithRetry(fetchFn, attempts);
}

export async function fetchArrayBuffer(url: string, attempts: number = 1) {
  const fetchFn: FetchFn<ArrayBuffer> = () =>
    fetch(url).then((res) => res.arrayBuffer());
  return fetchWithRetry(fetchFn, attempts);
}
export const FetchLoader = {
  fetchText,
  fetchArrayBuffer,
};
