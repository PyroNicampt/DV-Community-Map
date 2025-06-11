Assuming Visual Studio Community:

1. Add the following to the `lib` folder from `[steam common dir]/Derail Valley/DerailValley_Data/Managed`:
- `Assembly-CSharp.dll`
- `BezierCurves.dll`
- `DV.Common.dll`
- `DV.OriginShiftInfo.dll`
- `DV.RailTrack.dll`
- `DV.UserManagement.dll`
- `DV.Utils.dll`
- `UnityEngine.dll`
- `UnityEngine.UI.dll`
- `UnityEngine.InputLegacyModule.dll`
- `UnityEngine.IMGUIModule.dll`
- `UnityEngine.CoreModule.dll`
- `/UnityModManager/0Harmony.dll`
- `/UnityModManager/UnityModManager.dll`

2. Build Solution
3. Copy the following files from `bin/Debug/` to `Derail Valley/Mods/CommunityMapLocation`
- `info.json`
- `CommunityMapLocation.dll`
- `Microsoft.Bcl.AsyncInterfaces.dll`
- `System.Buffers.dll`
- `System.IO.Pipelines.dll`
- `System.Memory.dll`
- `System.Numerics.Vectors.dll`
- `System.Runtime.CompilerServices.Unsafe.dll`
- `System.Text.Encodings.Web.dll`
- `System.Text.Json.dll`
- `System.Threading.Tasks.Extensions.dll`
- `System.ValueTuple.dll`

4. Run game using [Unity Mod Manager](https://www.nexusmods.com/site/mods/21)

Mod functions are all within the UMM settings screen.