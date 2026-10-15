# Changelog

## 1.0.9

- Persist the VPN login across restarts by giving WHMCS session cookies an explicit expiry, so Chromium keeps them in the partition's own cookie store. Removes the encrypted cookie backup that could be discarded by a single transient login detection.
- Match the WHMCS session cookie by name prefix; the site randomises that cookie name, so the previous exact-name list never matched it.
- Keep Cloudflare and chat-widget cookies session-scoped rather than pinning them for a year.
- Document that "remember me" must be ticked and that the site's session IP check can still force a re-login.

## 1.0.8

- Back up authenticated VPN cookies with Windows encryption and restore them before the first page load.
- Save cookie changes and wait for cookie storage to flush on exit.
- Clear the VPN backup on logout and retain cookie expiry and security attributes.
- Add automated cookie lifecycle and Electron restart tests.

## 1.0.7

Initial repository release of the combined desktop widget.

- Unified API balance and VPN traffic into one compact window.
- Added anchored detail expansion, edge snapping, tray menu and startup settings.
- Improved keyboard navigation, refresh feedback, stale-data indicators and persistent position.
- Restored API session backup, bounded refresh retries and corrected VPN traffic/date parsing.
