declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFData {
    text: string;
    numpages: number;
  }

  interface TextItem {
    str: string;
    dir: string;
  }

  interface TextContent {
    items: TextItem[];
  }

  interface PageData {
    getTextContent(): Promise<TextContent>;
  }

  interface PDFParseOptions {
    pagerender?: (pageData: PageData) => Promise<string>;
  }

  function PDFParse(
    dataBuffer: Buffer,
    options?: PDFParseOptions
  ): Promise<PDFData>;
  export default PDFParse;
}
