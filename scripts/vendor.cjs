const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'docs/vendor');
fs.mkdirSync(vendor, {recursive: true});
for (const name of ['react', 'react-dom']) {
  fs.copyFileSync(path.join(root, `node_modules/${name}/umd/${name}.production.min.js`), path.join(vendor, `${name}.production.min.js`));
  fs.copyFileSync(path.join(root, `node_modules/${name}/LICENSE`), path.join(vendor, `${name}.LICENSE.txt`));
}
esbuild.buildSync({entryPoints: [require.resolve('tone')], bundle: true, format: 'esm', platform: 'browser', outfile: path.join(vendor, 'tone.js'), minify: true, legalComments: 'eof'});
