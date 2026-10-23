import path from "node:path";
import {fileURLToPath} from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
export default {outputFileTracingRoot:path.resolve(here,"../.."),poweredByHeader:false};
