import {build} from 'esbuild';
import {copyFile,mkdir} from 'node:fs/promises';
const out='entry/src/main/resources/rawfile/web';await mkdir(out,{recursive:true});
await build({entryPoints:['web/app.mjs'],bundle:true,minify:true,format:'iife',target:['chrome110'],outfile:`${out}/app.js`,legalComments:'eof'});
for(const name of ['index.html','style.css'])await copyFile(`web/${name}`,`${out}/${name}`);
await copyFile('node_modules/openpgp/LICENSE',`${out}/OPENPGP-LICENSE.txt`);
