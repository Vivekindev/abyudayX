// Static export only for production builds (next dev + output:'export' breaks dynamic routes in Next 14).
// With output:'export', Next 14 uses a custom distDir as the export folder, so builds use 'out' (what
// Cloudflare Pages deploys); it also keeps the build's trace file away from the dev server's locked .next/.
const isBuild = process.env.NODE_ENV === 'production';
export default { output: isBuild ? 'export' : undefined, distDir: isBuild ? 'out' : '.next', trailingSlash: true, images: { unoptimized: true } };
