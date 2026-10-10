# Changelog

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
