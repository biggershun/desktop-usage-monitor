'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const entry=require.resolve('lucide/package.json');
fs.copyFileSync(path.join(path.dirname(entry),'dist','umd','lucide.js'),path.join(root,'lucide.js'));
console.log('Prepared local Lucide assets.');
