#!/bin/sh
set -eu
arch=${1:?Usage: build-backend.sh amd64-or-arm64}
case "$arch" in amd64|arm64) ;; *) exit 1 ;; esac
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root/upstream"
test "$(git rev-parse HEAD)" = 9e017722b51c812734494b4a3f2ae89870d23ce2
git apply "$root/patches/0001-dji-qdc507.patch"
cp "$root/tests/discovery_dji_test.go" internal/device/
go test ./internal/device -run 'TestDiscoverFallback|TestUSBAT|TestSelectBestAT|TestClassifyMode' -count=1
(cd web && npm ci --no-audit --no-fund && npm run build)
cp -R web/dist internal/web/dist
mkdir -p "$root/dist"
CGO_ENABLED=0 GOOS=linux GOARCH="$arch" go build -mod=readonly -trimpath -buildvcs=false -tags 'with_utls nomsgpack' \
    -ldflags '-s -w -X github.com/yibaiba/hideck/internal/global.Version=2.1.42-dji1' \
    -o "$root/dist/hideck-linux-$arch" ./cmd/hideck
