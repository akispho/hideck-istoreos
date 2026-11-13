# HiDeck for iStoreOS

为 **iStoreOS / OpenWrt 的 Docker 部署**补齐 HiDeck 的 LuCI 服务管理页，并提供 DJI EG25G-QDC507 兼容镜像。

这是独立的社区集成项目，HiDeck 上游为 [yibaiba/hideck](https://github.com/yibaiba/hideck)。不属于 DJI 官方软件，也不是向模块刷入固件。

## 功能

- 在 **服务 → HiDeck** 显示容器运行状态、健康检查，每 5 秒刷新。
- **启动 / 停止**直接控制 `hideck` 容器，**打开 HiDeck**另开管理界面。
- 在页面修改 HTTP 管理端口：校验 1–65535、检查 TCP 端口占用、失败时回退。停止状态下修改端口不会启动容器。
- 数据目录与账号、设备、短信、eSIM 相关配置保留在独立挂载目录。
- 精确支持 DJI **`2ca3:4006` EG25G-QDC507**：识别规则、设备局部 USB 接口 2 的 AT 串口选择，以及 OpenWrt 驱动热插拔绑定。
- Release 提供 `all.ipk` 和 `amd64 / arm64` Docker 镜像归档及 SHA256。无需登录 Docker Hub 或 GHCR。

## 适用环境

当前版本面向使用 **opkg** 的 iStoreOS，容器镜像支持 **x86_64 / aarch64**。Docker 数据目录和 HiDeck 数据目录应放在有足够空间的磁盘上，不建议放在容量很小的路由器根分区。

已在 **iStoreOS 24.10.8 / x86_64 / ESXi USB 直通 / DJI QDC507** 实机验证。ARM64 镜像由 CI 交叉编译，硬件和页面验收结果见 [验证记录](docs/validation.md)。本版不提供 APK 包，也不声称支持所有标为“大疆一代”的模块。

## 安装

先准备好 iStoreOS 的 Docker 服务与数据盘。以下 `/mnt/sda1/hideck` 是示例，请替换成实际数据盘上的目录。

```sh
curl -fL https://github.com/akispho/hideck-istoreos/releases/download/v0.1.0/install.sh -o /tmp/hideck-install.sh
# 可以先查看安装脚本，再执行：
sh /tmp/hideck-install.sh /mnt/sda1/hideck
```

脚本会下载并校验安装包和对应架构镜像，安装依赖、加载镜像、创建部署，再注册 LuCI 管理页。不会替换软件源、跳过内核依赖、调整家庭网络配置、开启公网端口或接受 HiDeck 的使用协议。若 `opkg update` 报 404/内核不匹配，应先修好匹配当前固件的软件源，再安装。

安装后打开：

```text
http://路由器地址/cgi-bin/luci/admin/services/hideck
```

点击“打开 HiDeck”。HiDeck 初始账号为上游默认的 `admin / admin`；请自行阅读并确认上游协议，并修改密码。端口改动会短暂重建 HiDeck 容器，不会重新下载镜像、删除数据或重启路由器。

### 已有 HiDeck Docker 部署

先备份现有数据。安装脚本默认拒绝接管已有 `hideck` 容器；确认它的 Compose 工作目录与指定目录一致后才能加 `--adopt`：

```sh
sh /tmp/hideck-install.sh /mnt/sda1/hideck --adopt
```

接管会备份原 Compose 和 `.env`，保留 `config/`、`data/`、`logs/`，替换为本项目的固定版本镜像与 Compose 模板。已有容器若关闭，则仍保持关闭。自定义 Compose 环境、额外挂载和网络配置不会自动合并，应先手动迁移至本项目模板；目录不匹配时脚本拒绝操作。

### 只装 LuCI 包

也可在 [Releases](https://github.com/akispho/hideck-istoreos/releases) 下载 `luci-app-hideck_0.1.0-1_all.ipk` 并用 iStore 安装本地包或 `opkg install`。包只安装页面与控制工具，**不会自动创建或启动容器**；仍需用安装脚本加载兼容镜像、完成部署。

## 管理端口

页面中的端口保存到 `/etc/config/hideck` 和部署目录的 `.env`，通过 `PROXY_SERVER_PORT` 覆盖 HiDeck 的 HTTP 监听端口。不会重写 HiDeck 的 YAML，因此也不覆盖密码、设备和 eSIM 配置。Docker 健康检查和“打开 HiDeck”链接随端口更新。

这里只调整 **HTTP 管理端口**。HTTPS、WebRTC、代理端口由 HiDeck 自身管理。服务使用 host 网络；在 HiDeck 内部修改 YAML 的 `server.port` 不会覆盖本页面设置。点击保存时应避开通话、eSIM 下载等进行中的操作。

## DJI 模块与 eSIM

补丁固定基于 HiDeck **2.1.42 / `9e017722b51c812734494b4a3f2ae89870d23ce2`**，并固定上游容器摘要。仅给 `2ca3:4006` 增加自动发现，不扩大到所有 DJI USB 设备。AT 口按设备自身 USB 接口编号选择，避免全局 `ttyUSB` 编号变化选错端口。

模块必须先出现在 iStoreOS 的 `lsusb` 中；ESXi 用户需直通 **USB 设备**。修复不包含改 USB VID/PID、切换 USB 组合、刷固件或自动开 ADB。

扫描到模块后，在 HiDeck 中“添加设备”。存在 AT 串口不代表已具备 QMI/MBIM 拨号、VoLTE 或 USB 音频能力；本补丁不补齐这些硬件功能。可插拔 eUICC 的读写仍取决于卡片、固件和 HiDeck 支持，不保证任何卡都能成功下载配置。

## 构建、升级、卸载

```sh
node --test tests/panel.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 scripts/build-package.py
```

推送版本标签会触发 GitHub Actions：检出固定的 HiDeck 提交、应用 DJI 补丁并测试、构建前端和两种架构的程序、生成 Docker 镜像归档与 IPK、发布校验和。也提供标准 OpenWrt `Makefile`，可将仓库放入 SDK 的 `package/hideck-istoreos` 后编译 `package/hideck-istoreos/compile`。

本项目固定上游版本，不自动跟随 `latest`。更新上游需调整提交、基础镜像摘要、兼容补丁并重新验证。升级固件后的自定义页面和 Docker 数据保留取决于固件备份策略，必要时重新安装 IPK。

**不要用官方镜像直接覆盖 DJI 兼容镜像。** 当前上游版本的后台只提供检查更新和操作说明，应用内更新接口已禁用。兼容版会把更新说明指向本项目 Releases；之后从本项目安装对应更新，才能同时保留 DJI 补丁。上游正式合入相同支持并验收后，才适合切回官方构建。固定的本地镜像标签不会被 `docker compose pull` 自动升级。

`opkg remove luci-app-hideck` 只移除页面与控制工具；容器和数据保留。删除镜像、容器、eSIM 或数据目录必须由使用者另行决定。

## 许可与来源

本项目采用 [PolyForm Noncommercial 1.0.0](LICENSE)，保留 HiDeck 及其上游的 Required Notice；不把非商业许可描述成任意商业使用许可。HiDeck 及底层依赖声明见 [UPSTREAM_THIRD_PARTY_NOTICES.md](UPSTREAM_THIRD_PARTY_NOTICES.md)。原始 HiDeck 源码、固定提交及补丁均可追溯，项目不包含任何个人路由器配置、登录凭据、eSIM 配置或短信数据。

English: Community iStoreOS LuCI integration for HiDeck. Includes Docker start/stop/status, editable HTTP port with conflict checks and rollback, and exact DJI QDC507 USB discovery support. Packages target opkg-based iStoreOS on amd64/arm64. This is not modem firmware; upstream noncommercial license and notices remain applicable.
