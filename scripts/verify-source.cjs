// Offline syntax/relative-import verification. This does not replace a framework build or type check.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ts=require(process.env.QA_TYPESCRIPT_PATH||'typescript');
let failures=0,checked=0;
function visit(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){
  if(['node_modules','.next','.qa','dist','lib'].includes(item.name)&&item.isDirectory()&&directory===root)continue;
  const full=path.join(directory,item.name);
  if(item.isDirectory()){if(!['node_modules','.next','.qa','dist'].includes(item.name))visit(full);continue;}
  if(!/\.(tsx?|mjs|cjs|json)$/.test(item.name)||item.name.endsWith('.d.ts'))continue;
  const source=fs.readFileSync(full,'utf8');
  if(item.name.endsWith('.json')){try{JSON.parse(source);}catch{console.error('JSON parse failed',path.relative(root,full));failures++;}continue;}
  if(!/\.tsx?$/.test(item.name))continue;
  const result=ts.transpileModule(source,{fileName:full,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});
  for(const diagnostic of result.diagnostics||[]){if(diagnostic.category===ts.DiagnosticCategory.Error){console.error(path.relative(root,full),ts.flattenDiagnosticMessageText(diagnostic.messageText,' '));failures++;}}
  for(const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)){
    const base=path.resolve(path.dirname(full),match[1]);
    if(![base,base+'.ts',base+'.tsx',base+'.css',base.replace(/\.js$/,'.ts'),path.join(base,'index.ts')].some(p=>fs.existsSync(p))){console.error('Missing relative import',path.relative(root,full),match[1]);failures++;}
  }
  const output=path.join(root,'.qa',path.relative(root,full).replace(/\.tsx?$/,'.js'));
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,result.outputText);checked++;
}}
visit(root);
console.log(JSON.stringify({syntaxFilesChecked:checked,failures,note:'Syntax and relative imports only; external package types and framework build not checked.'}));
process.exitCode=failures?1:0;
