// app/src/app/api/actions/icon/route.ts    OWNER: P4
// Blink card icon. Actions require an absolute image URL; served here so no public/ asset is needed.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#FAFAF7"/>
<text x="256" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="150" fill="#16181D">Kept</text>
<rect x="96" y="360" width="200" height="24" fill="#1F7A4D"/><rect x="296" y="360" width="120" height="24" fill="#B42318"/>
</svg>`;

export const GET = () =>
  new Response(SVG, { headers: { "Content-Type": "image/svg+xml", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } });
