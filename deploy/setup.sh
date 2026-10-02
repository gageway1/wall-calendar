#!/usr/bin/env bash
# One-shot box setup for the wall calendar (Ubuntu Server LTS, fresh install).
# Run from the repo checkout on the box:   sudo ./deploy/setup.sh
# Safe to re-run: every step is idempotent.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo $0" >&2
  exit 1
fi

APP_USER="${SUDO_USER:?run via sudo from your normal user}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIOSK_USER=kiosk
PORT=4000
TZ_NAME=America/Indiana/Indianapolis

step() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

step "Timezone"
timedatectl set-timezone "$TZ_NAME"

step "Base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl ca-certificates gnupg git sqlite3 \
  cage fonts-noto-color-emoji fonts-inter alsa-utils ddcutil wlr-randr \
  wpasupplicant linux-firmware

step "Node 24 (NodeSource)"
if ! command -v node >/dev/null || [[ "$(node -v)" != v24.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
node -v

step "Google Chrome (deb, not the Chromium snap)"
if ! command -v google-chrome-stable >/dev/null; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://dl.google.com/linux/linux_signing_key.pub |
    gpg --dearmor --yes -o /etc/apt/keyrings/google-chrome.gpg
  echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
    >/etc/apt/sources.list.d/google-chrome.list
  apt-get update
  apt-get install -y google-chrome-stable
fi

step "Tailscale"
if ! command -v tailscale >/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

step "Kiosk user"
if ! id "$KIOSK_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /usr/sbin/nologin "$KIOSK_USER"
fi
usermod -aG video,render,input,audio "$KIOSK_USER"

step "App build"
if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "Missing $APP_DIR/.env — copy it from the PC first (scp .env <box>:$APP_DIR/)." >&2
  exit 1
fi
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci && npm run build"
sudo -u "$APP_USER" mkdir -p "$APP_DIR/data/backups"

step "wall-calendar.service"
cat >/etc/systemd/system/wall-calendar.service <<EOF
[Unit]
Description=Wall calendar (Express + SPA)
Wants=network-online.target
After=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/wall-calendar/server/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

step "Kiosk (cage + Chrome on tty1)"
cat >/usr/local/bin/wall-kiosk <<EOF
#!/usr/bin/env bash
# Started by cage. Waits for the app, then runs Chrome full screen.
for i in \$(seq 1 120); do
  curl -fs http://localhost:$PORT/api/health >/dev/null && break
  sleep 1
done
exec /usr/bin/google-chrome-stable \\
  --ozone-platform=wayland \\
  --user-data-dir=/home/$KIOSK_USER/chrome-profile \\
  --kiosk --app=http://localhost:$PORT \\
  --noerrdialogs --disable-session-crashed-bubble --disable-infobars \\
  --no-first-run --no-default-browser-check --password-store=basic \\
  --overscroll-history-navigation=0 --disable-pinch \\
  --autoplay-policy=no-user-gesture-required \\
  --disable-features=Translate
EOF
chmod 0755 /usr/local/bin/wall-kiosk

cat >/etc/pam.d/cage <<'EOF'
auth     required pam_unix.so nullok
account  required pam_unix.so
session  required pam_unix.so
session  required pam_systemd.so
EOF

cat >/etc/systemd/system/wall-kiosk.service <<EOF
[Unit]
Description=Wall calendar kiosk (cage + Chrome on tty1)
After=systemd-user-sessions.service plymouth-quit-wait.service dbus.socket systemd-logind.service getty@tty1.service wall-calendar.service
Wants=dbus.socket systemd-logind.service wall-calendar.service
Conflicts=getty@tty1.service
ConditionPathExists=/dev/tty1

[Service]
Type=simple
User=$KIOSK_USER
PAMName=cage
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
UtmpIdentifier=tty1
UtmpMode=user
StandardInput=tty-fail
StandardOutput=journal
StandardError=journal
# -d: no client-side decorations, -s: allow Ctrl+Alt+F2 to a console
ExecStart=/usr/bin/cage -d -s -- /usr/local/bin/wall-kiosk
Restart=always
RestartSec=3

[Install]
WantedBy=graphical.target
EOF

step "Audio: HDMI to the monitor's speaker (timer chime)"
usermod -aG audio "$APP_USER"
# The AOC shows up on the first HDMI pin (eld#2.0), which is PCM device 3 on this Intel HDA.
cat >/etc/asound.conf <<'EOF'
defaults.pcm.card 0
defaults.pcm.device 3
defaults.ctl.card 0
EOF
amixer -q -c 0 sset 'IEC958',0 on || true
alsactl store || true

step "Touch panel udev rules"
install -m 0644 "$APP_DIR/deploy/99-wall-touch.rules" /etc/udev/rules.d/99-wall-touch.rules
udevadm control --reload
udevadm trigger --subsystem-match=input --action=change

step "Nightly DB backup (keeps 14)"
cat >/etc/systemd/system/wall-backup.service <<EOF
[Unit]
Description=Back up the wall calendar database

[Service]
Type=oneshot
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/deploy/backup.sh
EOF
cat >/etc/systemd/system/wall-backup.timer <<'EOF'
[Unit]
Description=Nightly wall calendar backup

[Timer]
OnCalendar=*-*-* 02:30
Persistent=true

[Install]
WantedBy=timers.target
EOF

step "Let $APP_USER restart the app without a password (for deploy/update.sh)"
cat >/etc/sudoers.d/wall-calendar <<EOF
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart wall-calendar, /usr/bin/systemctl restart wall-kiosk
EOF
chmod 0440 /etc/sudoers.d/wall-calendar
visudo -cf /etc/sudoers.d/wall-calendar

step "No console blanking (night mode is the app's job)"
if ! grep -q consoleblank=0 /etc/default/grub; then
  sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 consoleblank=0"/' /etc/default/grub
  update-grub
fi

step "Enable services"
systemctl daemon-reload
systemctl set-default graphical.target
systemctl enable --now wall-calendar.service wall-backup.timer
systemctl enable wall-kiosk.service
systemctl restart wall-kiosk.service

cat <<EOF

Done. Next:
  sudo tailscale up            # sign in to the tailnet
  aplay -l                     # find the HDMI device for the timer chime (see deploy/README.md)
  journalctl -u wall-calendar -f
  journalctl -u wall-kiosk -f
EOF
