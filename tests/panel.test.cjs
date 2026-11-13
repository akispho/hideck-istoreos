const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(__dirname + '/../root/www/luci-static/resources/view/hideck/status.js', 'utf8');
function panel() {
    const state = { available: true, running: true, state: 'running', health: 'healthy', port: 7575 };
    const calls = [], notifications = [];
    let release;
    const action = new Promise(resolve => { release = resolve; });
    const view = new Function('view', 'rpc', 'poll', 'ui', 'E', 'window', source)(
        { extend: x => x },
        { declare: ({ method }) => async (port) => {
            calls.push(method);
            if (method === 'set_port') calls.push(port);
            if (method === 'status') return { ...state };
            return action;
        } },
        { add: () => {} },
        { addNotification: (...args) => notifications.push(args) },
        (tag, attrs, children) => ({ tag, attrs, children, value: attrs && attrs.value || '', style: {}, textContent: '' }),
        { location: { hostname: 'router.example' } }
    );
    view.render(state);
    return { view, state, calls, notifications, release };
}
test('running/stopped state controls the available actions and Web UI link', () => {
    const { view } = panel();
    assert.equal(view.stateNode.textContent, '运行中');
    assert.equal(view.startButton.disabled, true);
    assert.equal(view.stopButton.disabled, false);
    assert.equal(view.openLink.href, 'http://router.example:7575/');
    view.updateStatus({ available: true, running: false, state: 'exited' });
    assert.equal(view.stateNode.textContent, '已停止');
    assert.equal(view.startButton.disabled, false);
    assert.equal(view.stopButton.disabled, true);
    assert.equal(view.openLink.style.display, 'none');
});
test('editing survives status polling and applying updates the Web UI link', async () => {
    const { view, calls, state, release } = panel();
    view.portInput.value = '17575';
    view.updateStatus(state);
    assert.equal(view.portInput.value, '17575');
    const pending = view.portButton.attrs.click();
    state.port = 17575;
    release({ ok: true });
    await pending;
    assert.deepEqual(calls, ['set_port', 17575, 'status']);
    assert.equal(view.openLink.href, 'http://router.example:17575/');
    assert.equal(view.portButton.disabled, true);
});
test('invalid port is rejected before an RPC request', () => {
    const { view, calls, notifications } = panel();
    for (const value of ['0', '65536', '8.5', '80;stop', '']) {
        view.portInput.value = value;
        view.handleAction('port');
    }
    assert.equal(calls.length, 0);
    assert.equal(notifications.length, 5);
});
test('one click stops only once, then refreshes the actual status', async () => {
    const { view, calls, release, state } = panel();
    const pending = view.stopButton.attrs.click();
    view.stopButton.attrs.click();
    assert.equal(view.startButton.disabled, true);
    assert.equal(view.stopButton.disabled, true);
    state.running = false; state.state = 'exited';
    release({ ok: true });
    await pending;
    assert.deepEqual(calls, ['stop', 'status']);
    assert.equal(view.stateNode.textContent, '已停止');
    assert.equal(view.startButton.disabled, false);
});
test('action failure shows feedback and clears the busy state', async () => {
    const { view, notifications, release } = panel();
    const pending = view.handleAction('stop');
    release({ ok: false, error: 'Docker unavailable' });
    await pending;
    assert.equal(notifications.length, 1);
    assert.equal(view.pending, false);
    assert.equal(view.stopButton.disabled, false);
    view.updateStatus({ available: false, error: 'Container missing' });
    assert.equal(view.startButton.disabled, true);
    assert.equal(view.stopButton.disabled, true);
});
