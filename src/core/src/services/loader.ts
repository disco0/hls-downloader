export interface ILoader {
  fetchText(url: string, attempts?: number, init?: Partial<RequestInit>): Promise<string>;
  fetchArrayBuffer(url: string, attempts?: number, init?: Partial<RequestInit>): Promise<ArrayBuffer>;
}
