'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

var getStatus = rpc.declare({ object: 'luci.hideck', method: 'status', expect: { '': {} } });
var start = rpc.declare({ object: 'luci.hideck', method: 'start', expect: { '': {} } });
var stop = rpc.declare({ object: 'luci.hideck', method: 'stop', expect: { '': {} } });
var setPort = rpc.declare({ object: 'luci.hideck', method: 'set_port', params: ['port'], expect: { '': {} } });

return view.extend({
    load: function() {
        return getStatus().catch(function() {
            return { available: false, error: '暂时无法获取 HiDeck 状态。' };
        });
    },

    updateStatus: function(status) {
        this.status = status;
        if (status.port && this.savedPort !== status.port) {
            this.savedPort = status.port;
            this.portInput.value = String(status.port);
        }
        var states = { running: '运行中', exited: '已停止', created: '未启动', restarting: '正在重启', paused: '已暂停', removing: '正在移除', dead: '异常' };
        var health = { healthy: '正常', unhealthy: '异常', starting: '检查中', none: '未配置' };
        this.stateNode.textContent = status.available ? (states[status.state] || '状态未知') : '无法获取状态';
        this.stateNode.style.color = status.available && status.state === 'running' ? 'green' : 'red';
        this.healthNode.textContent = status.available && status.running ? (health[status.health] || '未知') : '—';
        this.errorNode.textContent = status.error || '';
        this.startButton.disabled = this.pending || !status.available || status.running || status.state === 'restarting';
        this.stopButton.disabled = this.pending || !status.available || !(status.running || status.state === 'restarting');
        this.openLink.style.display = status.running && status.state === 'running' ? '' : 'none';
        this.openLink.href = 'http://' + window.location.hostname + ':' + (status.port || 7575) + '/';
        this.portInput.disabled = this.pending || !status.available;
        this.portButton.disabled = this.pending || !status.available || this.portInput.value === String(this.savedPort);
    },

    refreshStatus: function() {
        return getStatus().then(this.updateStatus.bind(this)).catch(function() {
            this.updateStatus({ available: false, error: '暂时无法获取 HiDeck 状态，请稍后重试。' });
        }.bind(this));
    },

    handleAction: function(action) {
        if (this.pending) return;
        var port;
        if (action === 'port') {
            var value = this.portInput.value.trim();
            port = Number(value);
            if (!/^[0-9]{1,5}$/.test(value) || port < 1 || port > 65535) {
                ui.addNotification(null, E('p', {}, '请输入 1–65535 之间的整数端口。'), 'error');
                return;
            }
        }
        this.pending = true;
        this.updateStatus(this.status);
        return (action === 'start' ? start() : action === 'stop' ? stop() : setPort(port)).then(function(result) {
            if (!result.ok) throw new Error(result.error || '操作失败');
        }).catch(function(error) {
            ui.addNotification(null, E('p', {}, error.message), 'error');
        }).finally(function() {
            this.pending = false;
            return this.refreshStatus();
        }.bind(this));
    },

    render: function(status) {
        this.pending = false;
        this.stateNode = E('strong');
        this.healthNode = E('span');
        this.errorNode = E('p', { 'role': 'alert', 'style': 'color:red' });
        this.portInput = E('input', { 'id': 'hideck-port', 'type': 'number', 'min': '1', 'max': '65535', 'step': '1', 'class': 'cbi-input-text', 'value': String(status.port || 7575), 'input': function() { this.updateStatus(this.status); }.bind(this) });
        this.portButton = E('button', { 'type': 'button', 'class': 'cbi-button cbi-button-apply', 'click': this.handleAction.bind(this, 'port') }, '保存并应用');
        this.startButton = E('button', { 'type': 'button', 'class': 'cbi-button cbi-button-apply', 'click': this.handleAction.bind(this, 'start') }, '启动');
        this.stopButton = E('button', { 'type': 'button', 'class': 'cbi-button cbi-button-negative', 'click': this.handleAction.bind(this, 'stop') }, '停止');
        this.openLink = E('a', { 'class': 'cbi-button cbi-button-action', 'href': 'http://' + window.location.hostname + ':7575/', 'target': '_blank', 'rel': 'noopener noreferrer' }, '打开 HiDeck');
        function row(label, value, id) {
            return E('div', { 'class': 'cbi-value' }, [E('label', { 'class': 'cbi-value-title', 'for': id }, label), E('div', { 'class': 'cbi-value-field' }, value)]);
        }
        var content = E('div', { 'class': 'cbi-map' }, [
            E('h2', {}, 'HiDeck'),
            E('div', { 'class': 'cbi-map-descr' }, '管理 HiDeck 服务。启动后可打开管理界面，管理模块、短信和 eSIM。'),
            E('div', { 'class': 'cbi-map-descr' }, ['DJI 兼容版更新请使用 ', E('a', { 'href': 'https://github.com/akispho/hideck-istoreos/releases', 'target': '_blank', 'rel': 'noopener noreferrer' }, '本项目 Releases'), '；直接换成未含补丁的官方镜像可能丢失模块识别。']),
            E('div', { 'class': 'cbi-section' }, [
                E('h3', {}, '服务状态'),
                E('div', { 'aria-live': 'polite' }, [row('运行状态', this.stateNode), row('健康检查', this.healthNode)]),
                row('管理端口', [this.portInput, ' ', this.portButton, E('div', { 'class': 'cbi-value-description' }, '修改后会重新创建 HiDeck 容器；运行中的服务将短暂中断，已停止的服务保持关闭。')], 'hideck-port'),
                row('服务操作', [this.startButton, ' ', this.stopButton, ' ', this.openLink]),
                this.errorNode
            ])
        ]);
        this.updateStatus(status);
        poll.add(this.refreshStatus.bind(this), 5);
        return content;
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
