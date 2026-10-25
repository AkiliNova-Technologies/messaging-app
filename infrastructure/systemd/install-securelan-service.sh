#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer as root." >&2
  exit 1
fi
if [[ $# -ne 1 || ! -f $1 ]]; then
  echo "Usage: $0 /absolute/path/to/messenger.jar" >&2
  exit 1
fi
case $1 in /*) ;; *) echo "The JAR path must be absolute." >&2; exit 1 ;; esac

getent group securelan >/dev/null || groupadd --system securelan
id securelan >/dev/null 2>&1 || useradd --system --gid securelan --home-dir /var/lib/securelan --shell /usr/sbin/nologin securelan
getent group securelan-operators >/dev/null || groupadd --system securelan-operators
install -d -o root -g securelan -m 0750 /opt/securelan /etc/securelan /var/lib/securelan
install -o root -g securelan -m 0640 "$1" /opt/securelan/securelan-server.jar
install -o root -g root -m 0644 infrastructure/systemd/securelan-server.service /etc/systemd/system/securelan-server.service
install -o root -g root -m 0644 infrastructure/systemd/50-securelan-server.rules /etc/polkit-1/rules.d/50-securelan-server.rules
if [[ ! -e /etc/securelan/server.env ]]; then
  install -o root -g securelan -m 0640 /dev/null /etc/securelan/server.env
  echo "Created /etc/securelan/server.env; populate it before starting the service." >&2
fi
systemctl daemon-reload
echo "Installed but did not start SecureLAN. Configure /etc/securelan/server.env, add the desktop user to securelan-operators, then enable the unit."
