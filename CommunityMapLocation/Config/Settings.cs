using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using UnityEngine;
using UnityModManagerNet;

namespace CommunityMapLocation.Config
{
    public class Settings : UnityModManager.ModSettings, INotifyPropertyChanged
    {
        private int port = 9090;
        public int Port { get => port; set => Set(ref port, value); }

        private RequestSourceType requestSourceType = RequestSourceType.Specific;
        public RequestSourceType RequestSourceType { get => requestSourceType; set => Set(ref requestSourceType, value); }

        private string requestSource = "https://pyronicampt.github.io";
        public string RequestSource { get => requestSource; set => Set(ref requestSource, value); }

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

        public event PropertyChangedEventHandler PropertyChanged;

        // Todo: store and hold back property changes until Settings is saved to prevent rapidly reconfiguring server on each keypress?
        // Not yet used anywhere, so could revert to using standard auto-properties
        private void Set<T>(ref T field, T value, [CallerMemberName] string propertyName = null)
        {
            if (!EqualityComparer<T>.Default.Equals(field, value))
            {
                field = value;
                PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
            }
        }
    }
}
