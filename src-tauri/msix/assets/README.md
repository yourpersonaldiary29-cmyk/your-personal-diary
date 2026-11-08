# Logo overrides for the MSIX package

This folder is empty on purpose. `scripts/store/build-msix.mjs` generates every logo of the
package from `src-tauri/icons/icon.png` (see `scripts/store/msix-assets.mjs`):

- `StoreLogo`, `Square44x44Logo`, `Square150x150Logo`, `Wide310x150Logo`, `Square310x310Logo`
  as `<Name>.scale-100|125|150|200|400.png`
  (`Square310x310Logo.scale-400` is skipped: it would need a larger source icon than 512 px);
- `Square44x44Logo.targetsize-<16|20|24|30|32|36|40|48|60|64|72|80|96|256>.png`, each also as
  `_altform-unplated` and `_altform-lightunplated` (taskbar, Start list, Alt+Tab).

To replace a generated file with a hand-made one, put a PNG with exactly the same file name
here, for example `Wide310x150Logo.scale-200.png` (620x300). The build script copies it instead
of generating it and stops if its pixel size is not the expected one. Do not add files with
other names: the package check (`scripts/store/check-msix.mjs`) rejects unknown assets.
