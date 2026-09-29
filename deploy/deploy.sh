#!/usr/bin/env bash
# =============================================================================
#  EduSkill Center — deploy / update script
# =============================================================================
#  Run it from inside the app folder, as the app user (NOT root):
#      cd /var/www/center
#      ./deploy/deploy.sh
#
#  What it does, in order:
#      1. sanity checks (not root, folder looks right, .env present, disk free)
#      2. git pull        (skipped automatically if this is not a git checkout)
#      3. npm ci          (postinstall runs `prisma generate`)
#      4. npm run db:deploy   -> prisma migrate deploy   (NEVER a reset)
#      5. npm run build       with BASE_PATH exported from .env
#      6. restart the systemd service
#      7. health-check the public URL
#
#  It NEVER writes anything outside this folder, never drops a database, and
#  never touches the existing website or its web-server config.
#
#  Flags:
#      --no-pull     skip step 2 (you copied the files up yourself, e.g. rsync)
#      --no-build    skip step 5 (only migrations changed)
#      --allow-root  run as root anyway (discouraged: it leaves root-owned files
#                    in .next and node_modules, and the service user then cannot
#                    write the Next runtime cache)
#      --dry-run     print every step without executing anything
# =============================================================================

set -euo pipefail

# --- where we are ------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

DO_PULL=1
DO_BUILD=1
ALLOW_ROOT=0
DRY_RUN=0
SERVICE_NAME="${SERVICE_NAME:-eduskill-center}"

for arg in "$@"; do
  case "$arg" in
    --no-pull)    DO_PULL=0 ;;
    --no-build)   DO_BUILD=0 ;;
    --allow-root) ALLOW_ROOT=1 ;;
    --dry-run)    DRY_RUN=1 ;;
    -h|--help)    sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg  (try --help)" >&2; exit 2 ;;
  esac
done

# --- pretty output -----------------------------------------------------------
C_B="\033[1m"; C_G="\033[32m"; C_Y="\033[33m"; C_R="\033[31m"; C_0="\033[0m"
step()  { printf "\n${C_B}==> %s${C_0}\n" "$*"; }
info()  { printf "    %s\n" "$*"; }
ok()    { printf "    ${C_G}OK${C_0}  %s\n" "$*"; }
warn()  { printf "    ${C_Y}!!${C_0}  %s\n" "$*"; }
die()   { printf "\n${C_R}FAILED:${C_0} %s\n" "$*" >&2; exit 1; }

# Print a command, then run it (or not, under --dry-run).
run() {
  printf "    ${C_B}\$${C_0} %s\n" "$*"
  if [ "$DRY_RUN" -eq 0 ]; then "$@"; fi
}

# =============================================================================
step "1/7  Pre-flight checks"
# =============================================================================

if [ "$(id -u)" -eq 0 ] && [ "$ALLOW_ROOT" -eq 0 ]; then
  die "Do not run this as root. Switch to the app user:
       sudo -u eduskill -H bash -lc 'cd ${APP_DIR} && ./deploy/deploy.sh'
     (or pass --allow-root if you really mean it)"
fi

[ -f "${APP_DIR}/package.json" ]   || die "No package.json in ${APP_DIR} — wrong folder?"
grep -q '"name": "eduskillcenter"' "${APP_DIR}/package.json" \
  || die "${APP_DIR}/package.json is not the EduSkill Center project. Refusing."
[ -f "${APP_DIR}/.env" ]           || die "No .env in ${APP_DIR}. Copy deploy/.env.production.example to .env and fill it in."

info "App folder     : ${APP_DIR}"
info "Service        : ${SERVICE_NAME}"
if [ "$DRY_RUN" -eq 1 ]; then warn "DRY RUN — nothing will actually be executed."; fi

# Read the three values we need out of .env without sourcing it (a stray shell
# character in a password must not be executed).
env_get() { sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "${APP_DIR}/.env" | tail -1 | sed -e 's/^"//' -e "s/^'//" -e 's/"[[:space:]]*$//' -e "s/'[[:space:]]*$//"; }

BASE_PATH="$(env_get BASE_PATH || true)"
APP_URL="$(env_get APP_URL || true)"
PORT="$(env_get PORT || true)"
PORT="${PORT:-3001}"

[ -n "$APP_URL" ] || die "APP_URL is not set in .env"
info "BASE_PATH      : '${BASE_PATH}'   (empty = served at the domain root)"
info "APP_URL        : ${APP_URL}"
info "PORT           : ${PORT}"

# APP_URL must end with BASE_PATH, otherwise emails and certificate QR codes
# point at the wrong place while the site itself looks fine.
if [ -n "$BASE_PATH" ] && [ "${APP_URL%"$BASE_PATH"}" = "$APP_URL" ]; then
  die "APP_URL ('${APP_URL}') does not end with BASE_PATH ('${BASE_PATH}').
     Expected something like https://eduskillindia.org${BASE_PATH}"
fi

command -v node >/dev/null || die "node is not installed"
command -v npm  >/dev/null || die "npm is not installed"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node 20 or newer is required (found $(node -v))"
info "Node           : $(node -v)"

# A Next.js build wants roughly 2 GB of headroom on this project.
AVAIL_MB="$(df -Pm "$APP_DIR" | awk 'NR==2 {print $4}')"
info "Free disk      : ${AVAIL_MB} MB"
if [ "$AVAIL_MB" -lt 2500 ] && [ "$DO_BUILD" -eq 1 ]; then
  warn "Less than 2.5 GB free. Clearing the old build cache first."
  run rm -rf "${APP_DIR}/.next/cache"
  AVAIL_MB="$(df -Pm "$APP_DIR" | awk 'NR==2 {print $4}')"
  if [ "$AVAIL_MB" -lt 1500 ]; then
    die "Still only ${AVAIL_MB} MB free. Free up space before deploying."
  fi
fi

# =============================================================================
step "2/7  Fetch the latest code"
# =============================================================================

if [ "$DO_PULL" -eq 0 ]; then
  info "Skipped (--no-pull). Using the files already in ${APP_DIR}."
elif [ -d "${APP_DIR}/.git" ]; then
  info "git checkout detected — pulling the current branch."
  run git -C "$APP_DIR" pull --ff-only
else
  info "Not a git checkout — nothing to pull."
  info "Copy the new files up first, e.g. from your machine:"
  info "  rsync -av --delete --exclude .env --exclude node_modules --exclude .next \\"
  info "        --exclude storage ./ user@server:${APP_DIR}/"
fi

# =============================================================================
step "3/7  Install dependencies  (npm ci)"
# =============================================================================
# Full install, NOT --omit=dev: the production build needs typescript, tailwind
# and the prisma CLI. The postinstall hook runs `prisma generate` for us.

if [ -f "${APP_DIR}/package-lock.json" ]; then
  run npm --prefix "$APP_DIR" ci
else
  warn "No package-lock.json — falling back to npm install."
  run npm --prefix "$APP_DIR" install
fi

step "3b/7  Regenerate the Prisma client"
run npm --prefix "$APP_DIR" run db:generate

# =============================================================================
step "4/7  Apply database migrations  (prisma migrate deploy)"
# =============================================================================
# `db:deploy` only applies migrations that have not run yet. It never drops or
# recreates anything. NEVER use `prisma migrate reset` or `npm run db:reset` on
# this server — those are development-only and destroy data.

run npm --prefix "$APP_DIR" run db:deploy

# =============================================================================
step "5/7  Build  (BASE_PATH='${BASE_PATH}')"
# =============================================================================
# BASE_PATH is baked into the bundle at build time. It is exported explicitly
# here so the build can never silently pick up a different value than .env says.

if [ "$DO_BUILD" -eq 0 ]; then
  warn "Skipped (--no-build). The running build keeps its old BASE_PATH."
else
  info "Removing the previous build output so no stale chunks survive."
  run rm -rf "${APP_DIR}/.next"
  if [ "$DRY_RUN" -eq 0 ]; then
    ( cd "$APP_DIR" && BASE_PATH="$BASE_PATH" NODE_ENV=production npm run build )
  else
    info "cd ${APP_DIR} && BASE_PATH='${BASE_PATH}' NODE_ENV=production npm run build"
  fi
  ok "Build finished."
fi

# Make sure the storage folder exists and is writable (uploads land here).
STORAGE_DIR="$(env_get STORAGE_LOCAL_DIR || true)"; STORAGE_DIR="${STORAGE_DIR:-./storage}"
case "$STORAGE_DIR" in /*) ;; *) STORAGE_DIR="${APP_DIR}/${STORAGE_DIR#./}" ;; esac
run mkdir -p "$STORAGE_DIR"

# =============================================================================
step "6/7  Restart the service"
# =============================================================================

if command -v systemctl >/dev/null && systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}.service"; then
  info "Restarting ${SERVICE_NAME} (this touches no other service on this VPS)."
  run sudo systemctl restart "${SERVICE_NAME}"
  if [ "$DRY_RUN" -eq 0 ]; then
    sleep 4
    systemctl is-active --quiet "${SERVICE_NAME}" \
      || die "${SERVICE_NAME} did not start. Logs:  journalctl -u ${SERVICE_NAME} -n 60 --no-pager"
    ok "${SERVICE_NAME} is active."
  fi
elif command -v pm2 >/dev/null && pm2 list 2>/dev/null | grep -q "${SERVICE_NAME}"; then
  info "PM2 process found — reloading instead."
  run pm2 reload "${SERVICE_NAME}" --update-env
else
  warn "Neither a systemd unit nor a PM2 process named '${SERVICE_NAME}' was found."
  warn "Install deploy/eduskill-center.service (or start PM2) and re-run."
fi

# =============================================================================
step "7/7  Health check"
# =============================================================================

if [ "$DRY_RUN" -eq 1 ]; then
  info "Skipped under --dry-run."
else
  LOCAL_URL="http://127.0.0.1:${PORT}${BASE_PATH}/api/public/stats"
  PUBLIC_URL="${APP_URL%/}/api/public/stats"

  info "Waiting for the app to answer on ${LOCAL_URL}"
  local_ok=0
  for i in $(seq 1 20); do
    if curl -fsS --max-time 5 "$LOCAL_URL" >/dev/null 2>&1; then local_ok=1; break; fi
    sleep 2
  done
  [ "$local_ok" -eq 1 ] || die "The app is not responding on 127.0.0.1:${PORT}.
     Check:  journalctl -u ${SERVICE_NAME} -n 60 --no-pager"
  ok "App responds locally."

  info "Checking the public URL ${PUBLIC_URL}"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$PUBLIC_URL" || echo 000)"
  case "$code" in
    200) ok "Public health check passed (HTTP 200)." ;;
    502|504) warn "HTTP ${code} — the web server cannot reach 127.0.0.1:${PORT}.
        Is the proxy block installed and the port right? (deploy/nginx-center.conf)" ;;
    404) warn "HTTP 404 — the web server is answering but not proxying ${BASE_PATH}.
        Usual cause: proxy_pass has a trailing slash and strips the prefix." ;;
    000) warn "No response — DNS, TLS or firewall. Try from the server: curl -I ${APP_URL%/}/" ;;
    *)   warn "Unexpected HTTP ${code} from ${PUBLIC_URL}" ;;
  esac
fi

printf "\n${C_G}${C_B}Deploy complete.${C_0}  %s\n" "${APP_URL%/}/"
printf "    Logs:  journalctl -u %s -f\n\n" "${SERVICE_NAME}"

# =============================================================================
#  sudo note: only the `systemctl restart` step needs elevation. To avoid a
#  password prompt on every deploy, add ONE narrow rule with `sudo visudo -f
#  /etc/sudoers.d/eduskill-center`:
#      eduskill ALL=(root) NOPASSWD: /bin/systemctl restart eduskill-center
#  That grants nothing else on the server.
# =============================================================================
