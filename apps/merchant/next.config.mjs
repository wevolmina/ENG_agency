import path from "node:path";
import {fileURLToPath} from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
export default {transpilePackages:["@bridge/staff-ui"],outputFileTracingRoot:path.resolve(here,"../.."),poweredByHeader:false};
