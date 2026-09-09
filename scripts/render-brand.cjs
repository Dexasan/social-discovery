/** Render the original SVG mark. Pass a path to @resvg/resvg-js if it is installed outside the repo. */
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require(process.argv[2] || '@resvg/resvg-js');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'assets/brand');
const source = fs.readFileSync(path.join(directory, 'yappie-mark.svg'), 'utf8');
const artwork = source.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const wrap = (content) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512" fill="none">${content}</svg>`;
const render = (name, svg) => fs.writeFileSync(path.join(directory, name), new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng());
render('yappie-mark.png', source);
render('yappie-icon.png', wrap(`<rect width="512" height="512" fill="#111110"/><g transform="translate(31 31) scale(.88)">${artwork}</g>`));
// Keep all foreground art inside Android's central circular safe area (66/108).
render('yappie-adaptive-foreground.png', wrap(`<g transform="translate(115.2 115.2) scale(.55)">${artwork}</g>`));
const monochrome = artwork.replace(/#FF775D|#F1EBDD/g, '#FFFFFF').replace(/#111110/g, '#111110');
// Alpha-only silhouette for themed launchers; facial details are transparent cutouts.
render('yappie-monochrome.png', wrap(`<defs><mask id="silhouette" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><g transform="translate(115.2 115.2) scale(.55)">${monochrome.replace(/#111110/g, '#000000')}</g></mask></defs><rect width="512" height="512" fill="white" mask="url(#silhouette)"/>`));
console.log('Rendered mark, app icon, adaptive foreground, and themed icon.');

