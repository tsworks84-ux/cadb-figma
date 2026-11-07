module.exports = {
  apps: [
    {
      name: "cadb-api",
      cwd: "/home/ubuntu/CADB/apps/api",
      script: "node",
      args: "dist/server.js",
    },
    {
      name: "cadb-web",
      cwd: "/home/ubuntu/CADB/apps/web",
      // Run Next.js directly. Going through `pnpm exec` left two idle pnpm
      // processes holding ~170 MB on a 2 GB server (changed 2026-11-07).
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "fork",
      env: {
        NEXT_PUBLIC_API_URL: "http://65.0.41.55",
        NODE_ENV: "production",
      },
    },
  ],
};
