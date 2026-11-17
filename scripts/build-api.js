const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

console.log('[BUILD-API] Starting API bundle process...');

// 1. Gather all 14 standard font definitions
const fontMap = {
  'Courier': 'Courier.cjs',
  'Courier-Bold': 'CourierBold.cjs',
  'Courier-BoldOblique': 'CourierBoldOblique.cjs',
  'Courier-Oblique': 'CourierOblique.cjs',
  'Helvetica': 'Helvetica.cjs',
  'Helvetica-Bold': 'HelveticaBold.cjs',
  'Helvetica-BoldOblique': 'HelveticaBoldOblique.cjs',
  'Helvetica-Oblique': 'HelveticaOblique.cjs',
  'Symbol': 'Symbol.cjs',
  'Times-Bold': 'TimesBold.cjs',
  'Times-BoldItalic': 'TimesBoldItalic.cjs',
  'Times-Italic': 'TimesItalic.cjs',
  'Times-Roman': 'TimesRoman.cjs',
  'ZapfDingbats': 'ZapfDingbats.cjs'
};

const fontData = {};
for (const [fontName, fileName] of Object.entries(fontMap)) {
  const filePath = path.resolve(__dirname, '../node_modules/pdfkit/js/standard-fonts', fileName);
  if (fs.existsSync(filePath)) {
    fontData[fontName] = require(filePath);
  } else {
    console.warn(`[WARN] Font file missing: ${filePath}`);
  }
}
console.log(`[BUILD-API] Loaded ${Object.keys(fontData).length} standard fonts into memory.`);

// 2. Run esbuild
const outfile = path.resolve(__dirname, '../apps/api/index.js');
const apiOutfile = path.resolve(__dirname, '../api/index.js');

esbuild.buildSync({
  entryPoints: [path.resolve(__dirname, '../apps/api/src/app.js')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile,
  external: []
});

console.log('[BUILD-API] esbuild compilation finished.');

// 3. Post-process the bundled file to inline standard fonts
let bundleCode = fs.readFileSync(outfile, 'utf8');

// Find the registerStdFontLoaders block with require$1("#standard-fonts/...")
const fontLoaderRegex = /registerStdFontLoaders\(\s*\{[\s\S]*?require\$1\("#standard-fonts\/ZapfDingbats"\)[\s\S]*?\}\s*\);/;

if (fontLoaderRegex.test(bundleCode)) {
  const inlinedBlock = `const __EMBEDDED_STANDARD_FONTS__ = ${JSON.stringify(fontData)};
    registerStdFontLoaders({
${Object.keys(fontData)
  .map(name => `      ${JSON.stringify(name)}: () => __EMBEDDED_STANDARD_FONTS__[${JSON.stringify(name)}]`)
  .join(',\n')}
    });`;

  bundleCode = bundleCode.replace(fontLoaderRegex, inlinedBlock);
  console.log('[BUILD-API] Successfully inlined standard fonts into bundle.');
} else {
  console.warn('[BUILD-API] WARNING: fontLoaderRegex did not match registerStdFontLoaders.');
}

// Write to apps/api/index.js and api/index.js
fs.writeFileSync(outfile, bundleCode, 'utf8');
fs.mkdirSync(path.dirname(apiOutfile), { recursive: true });
fs.writeFileSync(apiOutfile, bundleCode, 'utf8');
console.log('[BUILD-API] Saved bundles to apps/api/index.js and api/index.js');

// 4. Also copy web dist into apps/api/dist and apps/api/src/assets if available
const webDist = path.resolve(__dirname, '../apps/web/dist');
const apiDist = path.resolve(__dirname, '../apps/api/dist');
const apiAssetsDir = path.resolve(__dirname, '../apps/api/src/assets');
if (fs.existsSync(webDist)) {
  fs.cpSync(webDist, apiDist, { recursive: true });
  console.log('[BUILD-API] Synced apps/web/dist to apps/api/dist for static fallthrough.');
  const indexFile = path.join(webDist, 'index.html');
  if (fs.existsSync(indexFile)) {
    fs.mkdirSync(apiAssetsDir, { recursive: true });
    fs.copyFileSync(indexFile, path.join(apiAssetsDir, 'index.html'));
    console.log('[BUILD-API] Copied index.html to apps/api/src/assets/index.html for embedded delivery.');
  }
}
