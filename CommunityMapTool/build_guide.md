Assuming Visual Studio Community:

1. Add the following to the `lib` folder from `[steam common dir]/Derail Valley/DerailValley_Data/Managed/UnityModManager`:
- `Assembly-CSharp.dll`
- `BezierCurves.dll`
- `DV.OriginShiftInfo.dll`
- `DV.RailTrack.dll`
- `DV.Utils.dll`
- `UnityEngine.dll`
- `UnityEngine.UI.dll`
- `UnityEngine.InputLegacyModule.dll`
- `UnityEngine.IMGUIModule.dll`
- `UnityEngine.CoreModule.dll`
- `/UnityModManager/0Harmony.dll`
- `/UnityModManager/UnityModManager.dll`

2. Build Solution
3. Copy `info.json` and `bin/debug/CommunityMapTool.dll` to `Derail Valley/Mods/CommunityMapTool`
4. Run game using [Unity Mod Manager](https://www.nexusmods.com/site/mods/21)

Mod functions are all within the UMM settings screen.