#!/usr/bin/env python3
"""Build the OpenWrt gzip/tar IPK format without a cross-compilation SDK."""
import gzip
import io
import os
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = (ROOT / 'VERSION').read_text().strip() + '-1'
EPOCH = int(os.environ.get('SOURCE_DATE_EPOCH', '0'))


def archive(entries):
    stream = io.BytesIO()
    with gzip.GzipFile(fileobj=stream, mode='wb', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.GNU_FORMAT) as tar:
            for name, data, mode in sorted(entries):
                item = tarfile.TarInfo('./' + name)
                item.size, item.mode, item.mtime = len(data), mode, EPOCH
                item.uid = item.gid = 0
                item.uname = item.gname = 'root'
                tar.addfile(item, io.BytesIO(data))
    return stream.getvalue()


def build():
    entries = []
    for path in (ROOT / 'root').rglob('*'):
        if not path.is_file():
            continue
        name = path.relative_to(ROOT / 'root').as_posix()
        executable = name.startswith(('usr/libexec/', 'etc/hotplug.d/', 'etc/uci-defaults/'))
        entries.append((name, path.read_bytes(), 0o755 if executable else 0o644))
    for name in ['LICENSE', 'UPSTREAM_THIRD_PARTY_NOTICES.md']:
        entries.append(('usr/share/hideck/' + name, (ROOT / name).read_bytes(), 0o644))
    data = archive(entries)
    control = f'''Package: luci-app-hideck
Version: {VERSION}
Architecture: all
Maintainer: akispho <https://github.com/akispho/hideck-istoreos>
Section: luci
Priority: optional
License: PolyForm-Noncommercial-1.0.0
Depends: luci-base, luci-compat, docker, dockerd, docker-compose, kmod-usb-serial-option, curl, ca-bundle
Installed-Size: {sum(len(data) for _, data, _ in entries)}
Description: HiDeck Docker service manager for iStoreOS, with editable HTTP port and DJI QDC507 support.
'''
    postinst = '#!/bin/sh\n[ -n "$IPKG_INSTROOT" ] && exit 0\nsh /etc/uci-defaults/90-hideck\n'
    control_data = archive([('control', control.encode(), 0o644), ('conffiles', b'/etc/config/hideck\n', 0o644), ('postinst', postinst.encode(), 0o755)])
    output = ROOT / 'dist' / f'luci-app-hideck_{VERSION}_all.ipk'
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(archive([('debian-binary', b'2.0\n', 0o644), ('control.tar.gz', control_data, 0o644), ('data.tar.gz', data, 0o644)]))
    print(output)
    return output


if __name__ == '__main__':
    build()
