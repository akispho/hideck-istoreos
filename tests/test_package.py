import importlib.util
import io
from pathlib import Path
import tarfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_package', ROOT / 'scripts/build-package.py')
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PackageTests(unittest.TestCase):
    def test_installable_layout_permissions_and_conffile(self):
        output = package.build()
        with tarfile.open(output) as outer:
            self.assertEqual(outer.extractfile('./debian-binary').read(), b'2.0\n')
            control_bytes = outer.extractfile('./control.tar.gz').read()
            data_bytes = outer.extractfile('./data.tar.gz').read()
        with tarfile.open(fileobj=io.BytesIO(control_bytes)) as control:
            text = control.extractfile('./control').read().decode()
            self.assertIn('Architecture: all', text)
            self.assertIn('Depends: luci-base, luci-compat, docker, dockerd, docker-compose', text)
            self.assertEqual(control.extractfile('./conffiles').read(), b'/etc/config/hideck\n')
        with tarfile.open(fileobj=io.BytesIO(data_bytes)) as data:
            for name in ['usr/libexec/rpcd/luci.hideck', 'usr/libexec/hideck/manage', 'usr/libexec/hideck/setup', 'etc/hotplug.d/usb/30-dji-qdc507']:
                self.assertEqual(data.getmember('./' + name).mode, 0o755)
            self.assertIn('server:', data.extractfile('./usr/share/hideck/config.yaml').read().decode())
            self.assertTrue(data.getmember('./usr/share/hideck/LICENSE'))
            self.assertFalse(any('config/config.yaml' in item.name for item in data))

    def test_release_versions_match(self):
        version = (ROOT / 'VERSION').read_text().strip()
        self.assertIn('VERSION=' + version, (ROOT / 'install.sh').read_text())
        self.assertEqual((ROOT / 'root/usr/share/hideck/image').read_text().strip(), 'hideck-istoreos:' + version)
        self.assertIn('PKG_VERSION:=' + version, (ROOT / 'Makefile').read_text())


if __name__ == '__main__':
    unittest.main()
