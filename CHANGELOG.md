# Change Log
All notable changes to the "roblox-lua-autofills" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]
- Added color picker support to Color3.fromHSV().

## [1.7.1]
- Service auto-importer will now suggest for non-idiomatic whitespace in service declarations.

## [1.7.0]
- [Added service auto-importing](https://twitter.com/evaeraevaera/status/1180035299453349889)

## [1.6.1]
- Extension companion executable is now both signed and self-verified in the extension.

## [1.6.0]
- [Added autofill for modules in Rojo projects](https://twitter.com/Kampfkarren/status/1172119087830323200).
- Fixed a bug with service member autofill appearing when it shouldn't.
- Service member autofill will no longer show members you can't access.

## [1.5.0]
- [Added autofill for service members.](https://twitter.com/Kampfkarren/status/1171544346304245760)

## [1.4.1]
- Fixed a bug where new/deleted files would not be shown in the Rojo `require` autocomplete.

## [1.4.0]
- [Added support for Rojo file path autocompletes](https://twitter.com/Kampfkarren/status/1170469019675025408)

## [1.3.2]
- Fixed Enum autofill not triggering if there was a non-whitespace before it.

## [1.3.1]
- Changed prefix for GetService autofill to game:GetService to make it more intuitive.

## [1.3.0]
- [Added support for Color3 previewing/picking](https://twitter.com/Kampfkarren/status/1130213715872083968)

## [1.2.3]
- Fixed a bug where Enum autocompletes would not fire if tabbed whitespace was before them

## [1.2.2]
- Instance.new autofill will no longer show deprecated instances

## [1.2.1]
- Added Instance.new autofill to README

## [1.2.0]
- Added autofill for Instance.new
![](https://giant.gfycat.com/ExemplaryPowerlessHyracotherium.gif)

## [1.1.0]
- [Added snippet to automatically fill GetService](https://github.com/Kampfkarren/roblox-lua-autofills/pull/1)

## [1.0.0]
- Initial release
- Added autofill for Enums
