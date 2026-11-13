import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
FAKE = '''#!PYTHON
import json, os, pathlib, sys
root = pathlib.Path(os.environ['FIXTURE'])
p = root / 'state.json'
s = json.loads(p.read_text())
name, args = pathlib.Path(sys.argv[0]).name, sys.argv[1:]
with (root / 'calls').open('a') as f: f.write(name + ' ' + ' '.join(args) + '\\n')
if name == 'uci':
    if args[:2] == ['-q', 'get']:
        print(str(root) if args[2].endswith('data_dir') else s['port'])
    elif args[0] == 'set':
        s['port'] = args[1].split('=', 1)[1]; p.write_text(json.dumps(s))
elif name == 'netstat':
    if s.get('occupied'): print('tcp 0 0 0.0.0.0:17575 0.0.0.0:* LISTEN')
elif name == 'docker':
    if args[0] == 'inspect': print('true' if s['running'] else 'false')
    elif args[0] == 'compose' and s.get('fail_apply'):
        s['fail_apply'] = False; p.write_text(json.dumps(s)); sys.exit(1)
'''


class PortChangeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)
        (self.path / 'bin').mkdir()
        for name in ['uci', 'docker', 'netstat']:
            executable = self.path / 'bin' / name
            executable.write_text(FAKE.replace('PYTHON', sys.executable, 1))
            executable.chmod(0o755)
        self.env = {**os.environ, 'PATH': str(self.path / 'bin') + ':' + os.environ['PATH'], 'FIXTURE': str(self.path)}
        self.original = 'HIDECK_IMAGE=example:fixed\nHIDECK_PORT=7575\nKEEP=value\n'
        (self.path / '.env').write_text(self.original)
        (self.path / 'docker-compose.yml').write_text('services: {}\n')
        source = (ROOT / 'root/usr/libexec/hideck/manage').read_text()
        source = source.replace('/var/lock/hideck-port', str(self.path / 'lock'))
        (self.path / 'manage').write_text(source)

    def run_change(self, port='17575', **state):
        self.state = {'port': '7575', 'running': True, **state}
        (self.path / 'state.json').write_text(json.dumps(self.state))
        return subprocess.run(['sh', str(self.path / 'manage'), 'set-port', port], env=self.env, capture_output=True)

    def test_running_change_preserves_unrelated_env(self):
        result = self.run_change()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.path / '.env').read_text(), 'HIDECK_IMAGE=example:fixed\nKEEP=value\nHIDECK_PORT=17575\n')
        self.assertIn('up -d --pull never --force-recreate', (self.path / 'calls').read_text())
        self.assertEqual(json.loads((self.path / 'state.json').read_text())['port'], '17575')
        self.assertFalse((self.path / 'lock').exists())

    def test_stopped_container_is_not_started(self):
        self.assertEqual(self.run_change(running=False).returncode, 0)
        calls = (self.path / 'calls').read_text()
        self.assertIn('create --pull never --force-recreate', calls)
        self.assertNotIn('up -d', calls)

    def test_conflict_and_invalid_input_leave_files_unchanged(self):
        self.assertEqual(self.run_change(occupied=True).returncode, 3)
        self.assertEqual((self.path / '.env').read_text(), self.original)
        self.assertEqual(self.run_change('80;touch').returncode, 2)
        self.assertEqual((self.path / '.env').read_text(), self.original)

    def test_apply_failure_restores_file_and_port(self):
        self.assertEqual(self.run_change(fail_apply=True).returncode, 5)
        self.assertEqual((self.path / '.env').read_text(), self.original)
        self.assertEqual(json.loads((self.path / 'state.json').read_text())['port'], '7575')
        self.assertEqual((self.path / 'calls').read_text().count('up -d --pull never --force-recreate'), 2)


if __name__ == '__main__':
    unittest.main()
