local json = require "luci.jsonc"
local source = arg[1]
local commands = {}
local function run(method, output, code, request)
    local writes = {}
    local fn = assert(loadfile(source))
    setfenv(fn, setmetatable({
        arg = method,
        io = { read = function() return request or "{}" end, write = function(...) for _, s in ipairs({...}) do writes[#writes + 1] = s end end },
        require = function(name)
            if name == "luci.jsonc" then return json end
            if name == "uci" then return { cursor = function() return { get = function() return "7575" end } end } end
            assert(name == "luci.sys")
            return {
                exec = function(command)
                    assert(command == "docker inspect --type container --format '{{json .State}}' hideck 2>/dev/null")
                    return output
                end,
                call = function(command) commands[#commands + 1] = command; return code end
            }
        end,
        os = { exit = function() error("rejected method") end }
    }, { __index = _G }))
    fn()
    local output = table.concat(writes)
    if method[1] == "list" then assert(output:find('"status":{}', 1, true)) end
    return assert(json.parse(output))
end
local methods = run({"list"})
assert(methods.status and methods.start and methods.stop)
local state = run({"call", "status"}, '{"Running":true,"Status":"running","Health":{"Status":"healthy"}}')
assert(state.running and state.available and state.health == "healthy")
state = run({"call", "status"}, '{"Running":false,"Status":"exited"}')
assert(not state.running and state.available and state.state == "exited")
state = run({"call", "status"}, 'daemon unavailable')
assert(not state.available and state.error)
assert(run({"call", "start"}, nil, 0).ok)
assert(commands[#commands] == "/usr/libexec/hideck/manage start >/dev/null 2>&1")
assert(not run({"call", "stop"}, nil, 1).ok)
assert(commands[#commands] == "/usr/libexec/hideck/manage stop >/dev/null 2>&1")
local count = #commands
assert(not pcall(run, {"call", "start; touch /tmp/unsafe"}, nil, 0))
assert(#commands == count)
for _, request in ipairs({'{"port":"80;stop"}', '{"port":0}', '{"port":65536}', '{"port":3.5}', 'null', '[]'}) do
    assert(not run({"call", "set_port"}, nil, 0, request).ok)
end
assert(#commands == count)
assert(run({"call", "set_port"}, nil, 0, '{"port":17575}').ok)
assert(commands[#commands] == "/usr/libexec/hideck/manage set-port 17575 >/dev/null 2>&1")
assert(not run({"call", "set_port"}, nil, 3, '{"port":17575}').ok)
print("Backend checks passed: running, stopped, unavailable, action success/failure, fixed target, invalid method rejected")
