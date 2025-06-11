using System;
using System.Runtime.CompilerServices;
using UnityEngine;
using UnityModManagerNet;

namespace CommunityMapLocation.Config
{
    public class Settings : UnityModManager.ModSettings
    {
        public int Port { get; set; } = 9090;
        public RequestSourceType RequestSourceType { get; set; } = RequestSourceType.Specific;
        public string RequestSource { get; set; } = "https://pyronicampt.github.io";

        public void Draw()
        {
            GUILayout.BeginVertical(GUILayout.ExpandWidth(false));

            GUILayout.Label("Listening Port:");
            Port = Int32.TryParse(GUILayout.TextField(Port.ToString()), out var port) ? port : Port;

            GUILayout.Label("Allow connections from websites hosted anywhere, or a specific website?");

            UnityModManager.UI.ToggleGroup((int)RequestSourceType, Enum.GetNames(typeof(RequestSourceType)), i => RequestSourceType = (RequestSourceType)i);

            if (RequestSourceType == RequestSourceType.Specific)
            {
                GUILayout.Label("Website:");
                RequestSource = GUILayout.TextField(RequestSource);
            }

            GUILayout.EndVertical();
        }
    }
}
