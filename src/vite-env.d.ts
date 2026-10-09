/// <reference types="vite/client" />

declare module 'mammoth/mammoth.browser' {
  interface Result {
    value: string;
  }
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<Result>;
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<Result>;
  };
  export default mammoth;
}
