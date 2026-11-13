include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-hideck
PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_LICENSE:=PolyForm-Noncommercial-1.0.0
PKG_MAINTAINER:=akispho <https://github.com/akispho/hideck-istoreos>
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-hideck
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=HiDeck Docker manager for iStoreOS
  URL:=https://github.com/akispho/hideck-istoreos
  DEPENDS:=+luci-base +luci-compat +docker +dockerd +docker-compose +kmod-usb-serial-option +curl +ca-bundle
endef

define Package/luci-app-hideck/conffiles
/etc/config/hideck
endef

define Build/Compile
endef

define Package/luci-app-hideck/install
	$(CP) ./root/* $(1)/
	$(INSTALL_DATA) ./LICENSE ./UPSTREAM_THIRD_PARTY_NOTICES.md $(1)/usr/share/hideck/
	chmod 0755 $(1)/usr/libexec/rpcd/luci.hideck $(1)/usr/libexec/hideck/* $(1)/etc/hotplug.d/usb/30-dji-qdc507 $(1)/etc/uci-defaults/90-hideck
endef

define Package/luci-app-hideck/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
sh /etc/uci-defaults/90-hideck
endef

$(eval $(call BuildPackage,luci-app-hideck))
