declare module "multer" {
  import { RequestHandler } from "express";
  const multer: () => {
    /**
     * Returns a middleware that parses a single file from the request.
     * The implementation is not needed for type checking – we only need the
     * shape so that TypeScript accepts the import.
     */
    single(field: string): RequestHandler;
  };
  export default multer;
}
