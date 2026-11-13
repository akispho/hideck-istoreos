ARG BASE_IMAGE=yibaiba/hideck@sha256:0ed53e4330a8fa5b67d2deb2c8996447c2f29d1ebb40b6136b5b0457494baee3
FROM ${BASE_IMAGE}
ARG TARGETARCH
COPY --chmod=755 dist/hideck-linux-${TARGETARCH} /usr/local/bin/hideck
COPY LICENSE UPSTREAM_THIRD_PARTY_NOTICES.md /usr/share/doc/hideck-istoreos/
LABEL org.opencontainers.image.title="HiDeck for iStoreOS" \
      org.opencontainers.image.version="2.1.42-dji1" \
      org.opencontainers.image.source="https://github.com/akispho/hideck-istoreos" \
      org.opencontainers.image.description="HiDeck 2.1.42 with exact DJI QDC507 USB discovery support"
