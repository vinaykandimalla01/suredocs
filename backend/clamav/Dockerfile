FROM clamav/clamav:1.5.4

# SureDocs accepts files up to 50 MiB. ClamAV's default INSTREAM limit is
# 25 MiB, so raise it above the application limit while keeping a finite cap.
RUN sed -i 's/^#StreamMaxLength 25M/StreamMaxLength 64M/' /etc/clamav/clamd.conf \
    && grep -q '^StreamMaxLength 64M$' /etc/clamav/clamd.conf
