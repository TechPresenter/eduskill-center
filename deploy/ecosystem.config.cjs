/**
 * EduSkill Center — PM2 process file (ALTERNATIVE to systemd).
 *
 * ====================================================================
 *  USE EITHER PM2 **OR** deploy/eduskill-center.service — NOT BOTH.
 *  Both bind 127.0.0.1:3001; running them together gives EADDRINUSE and
 *  a half-working site. Pick one. systemd is the recommended default on
 *  a plain VPS; PM2 is handy if the existing website is already managed
 *  by PM2 on this server (check first: `pm2 list`).
 * ====================================================================
 *
 * Usage:
 *   cd <APP_DIR>
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save                       # remember across reboots
 *   pm2 startup                    # prints a sudo command — run it once
 *   pm2 logs eduskill-center
 *   pm2 reload eduskill-center     # zero-downtime restart after a deploy
 *
 * `.cjs` on purpose: package.json has "type": "module", so a plain
 * ecosystem.config.js would be parsed as ESM and PM2 would fail to load it.
 *
 * This project does NOT use `output: "standalone"`, so the start command is
 * `npm run start` (= `next start`), exactly like the systemd unit.
 */
module.exports = {
  apps: [
    {
      name: "eduskill-center",

      // Replace with the real path, e.g. /var/www/center
      cwd: "<APP_DIR>",

      script: "npm",
      args: "run start",

      // One process. Next.js keeps a Prisma connection pool per process, so
      // raising this multiplies database connections — only do it after raising
      // PostgreSQL's max_connections, and never on a shared VPS.
      instances: 1,
      exec_mode: "fork",

      // Load the same .env the systemd unit uses. Needs: pm2 install pm2-dotenv
      // OR simply rely on Next.js, which reads <APP_DIR>/.env itself at startup.
      // The values below are the ones that must not be left to chance.
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        HOSTNAME: "127.0.0.1",
        // BASE_PATH is a BUILD-TIME value baked in by `npm run build`.
        // Setting it here changes nothing on its own — it is repeated only so
        // that `pm2 restart --update-env` after a rebuild stays consistent.
        BASE_PATH: "/center",
      },

      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      // Restart if the process balloons past 1 GB (image optimisation spikes).
      max_memory_restart: "1G",
      kill_timeout: 30000,

      // Never let PM2 watch the app directory in production: a file touched by
      // an upload would restart the server.
      watch: false,

      merge_logs: true,
      time: true,
      out_file: "<APP_DIR>/logs/pm2-out.log",
      error_file: "<APP_DIR>/logs/pm2-error.log",
    },
  ],
};
