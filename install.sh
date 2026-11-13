#!/bin/sh
set -eu
VERSION=0.1.0
BASE="https://github.com/akispho/hideck-istoreos/releases/download/v$VERSION"
[ "$(id -u)" = 0 ] || { echo 'Please run as root on iStoreOS.' >&2; exit 1; }
command -v opkg >/dev/null || { echo 'This release requires an opkg-based iStoreOS installation.' >&2; exit 1; }
case "$(uname -m)" in
    x86_64) arch=amd64 ;;
    aarch64) arch=arm64 ;;
    *) echo 'Supported container architectures: x86_64 and aarch64.' >&2; exit 1 ;;
esac
root=${1:-}
case "$root" in /*) ;; *) echo 'Usage: sh install.sh /absolute/data/directory [--adopt]' >&2; exit 1 ;; esac
if ! command -v curl >/dev/null; then opkg update && opkg install curl ca-bundle; fi
work=$(mktemp -d /tmp/hideck-install.XXXXXX)
trap 'rm -rf "$work"' EXIT
trap 'exit 1' HUP INT TERM
cd "$work"
curl -fL --retry 2 "$BASE/SHA256SUMS" -o SHA256SUMS
pkg="luci-app-hideck_${VERSION}-1_all.ipk"
image="hideck-dji-linux-$arch.tar.gz"
for file in "$pkg" "$image"; do
    curl -fL --retry 2 "$BASE/$file" -o "$file"
    expected=$(awk -v name="$file" '$2 == name { print $1 }' SHA256SUMS)
    [ "${#expected}" = 64 ] || { echo "Missing checksum for $file" >&2; exit 1; }
    printf '%s  %s\n' "$expected" "$file" | sha256sum -c -
done
for dependency in luci-base luci-compat docker dockerd docker-compose kmod-usb-serial-option curl ca-bundle; do
    if ! opkg status "$dependency" 2>/dev/null | grep -q '^Status:.* installed'; then
        opkg update
        break
    fi
done
opkg install "$pkg"
docker info >/dev/null 2>&1 || { /etc/init.d/dockerd enable; /etc/init.d/dockerd start; }
docker load -i "$image"
/usr/libexec/hideck/setup "$root" "${2:-}"
