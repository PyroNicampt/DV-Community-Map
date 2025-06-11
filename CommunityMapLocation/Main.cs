using CommunityMapLocation.Api;
using CommunityMapLocation.Config;
using UnityModManagerNet;

namespace CommunityMapLocation
{
    [EnableReloading]
    public static class Main
    {
        public static Settings Settings { get; private set; }
        private static ApiServer apiServer;

        static bool Load(UnityModManager.ModEntry modEntry)
        {
            Settings = Settings.Load<Settings>(modEntry);

            apiServer = new ApiServer(Settings, modEntry.Logger);
            apiServer.AutoRegister();

            modEntry.OnToggle = OnToggle;
            modEntry.OnGUI = OnGUI;
            modEntry.OnSaveGUI = OnSaveGUI;

            return true;
        }

        public static bool OnToggle(UnityModManager.ModEntry modEntry, bool value)
        {
            if (value)
            {
                apiServer.Start();
            }
            else
            {
                apiServer.Stop();
            }

            return true;
        }

        static void OnGUI(UnityModManager.ModEntry modEntry)
        {
            Settings.Draw();
        }

        static void OnSaveGUI(UnityModManager.ModEntry modEntry)
        {
            Settings.Save(modEntry);

            apiServer.UpdateSettings();
        }
    }
}
