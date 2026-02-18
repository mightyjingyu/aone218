declare module 'pdf-parse/lib/pdf-parse.js' {
  function pdfParse(buffer: Buffer): Promise<{ numpages: number; text: string }>;
  export default pdfParse;
}
