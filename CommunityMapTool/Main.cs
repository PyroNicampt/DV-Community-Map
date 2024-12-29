using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityModManagerNet;
using DV.LocoRestoration;

namespace CommunityMapTool {
    [EnableReloading]
    static class Main {
        private static string trackOutputPath = "map_dump.json";
        private static string demonstratorOutputPath = "demo_dump.json";
        static bool Load(UnityModManager.ModEntry modEntry) {
            modEntry.OnUpdate = OnUpdate;
            modEntry.OnUnload = Unload;
            modEntry.OnGUI = OnGUI;
            return true;
        }
        static bool Unload(UnityModManager.ModEntry modEntry) {
            return true;
        }
        static void OnUpdate(UnityModManager.ModEntry modEntry, float dt) {
            if(Input.GetKeyDown(KeyCode.Home)){
                ClipboardPlayerPosition();
            }
        }
        static void OnGUI(UnityModManager.ModEntry modEntry) {
            if(GUILayout.Button("Dump All Tracks")) DumpAllTracks();
            if(GUILayout.Button("Dump Demonstrator Spawnpoints")) DemonstratorDump();
            if(GUILayout.Button("Copy Position To Clipboard")) ClipboardPlayerPosition();
        }

        static void ClipboardPlayerPosition() {
            if(PlayerManager.PlayerTransform == null) return;
            Vector3 pos = PlayerManager.PlayerTransform.AbsolutePosition();
            GUIUtility.systemCopyBuffer = $"{{\"x\":{pos.x},\"y\":{pos.y},\"z\":{pos.z}}}";
        }
        static void DumpAllTracks() {
            List<string> records = new List<string>();
            foreach(RailTrack railTrack in UnityEngine.Object.FindObjectsOfType<RailTrack>()) {
                StringBuilder sb = new StringBuilder();
                string[] baseCurveData = new[] {
                    "type", "bezier",
                    "name", railTrack.name,
                    "color", railTrack.curve.drawColor.ToString()
                };
                sb.Append("\n{");
                for(int i = 0; i < baseCurveData.Length; i++) {
                    if(i % 2 == 0) sb.Append($"\n\t\"{baseCurveData[i]}\":");
                    else sb.Append($"\"{baseCurveData[i]}\",");
                }
                sb.Append("\n\t\"points\":[");
                for(int i = 0; i < railTrack.curve.pointCount; i++) {
                    BezierPoint point = railTrack.curve[i];
                    sb.Append("\n\t\t{");
                    sb.Append($"\"position\":{{\"x\":{point.position.x},\"y\":{point.position.y},\"z\":{point.position.z}}}, ");
                    sb.Append($"\"h1\":{{\"x\":{point.globalHandle1.x},\"y\":{point.globalHandle1.y},\"z\":{point.globalHandle1.z}}}, ");
                    sb.Append($"\"h2\":{{\"x\":{point.globalHandle2.x},\"y\":{point.globalHandle2.y},\"z\":{point.globalHandle2.z}}}, ");
                    sb.Append($"\"type\":\"{point.handleStyle}\"");
                    sb.Append(i + 1 < railTrack.curve.pointCount ? "}," : "}");
                }
                sb.Append("\n\t]\n}");
                records.Add(sb.ToString());
            }
            File.WriteAllText(trackOutputPath, "[" + string.Join(",", records.ToArray()) + "\n]");
        }
        static void DemonstratorDump() {
            List<string> records = new List<string>();
            foreach(LocoRestorationSpawnPoint spawnPoint in UnityEngine.Object.FindObjectsOfType<LocoRestorationSpawnPoint>()) {
                StringBuilder sb = new StringBuilder();
                sb.Append("\n{");
                string[] jsonKVP = new[] {
                    "name", $"\"{spawnPoint.name}\"",
                    "position", $"{{\"x\":{spawnPoint.transform.position.x},\"y\":{spawnPoint.transform.position.y},\"z\":{spawnPoint.transform.position.z}}}",
                    "isUsed", spawnPoint.pointUsed ? "true" : "false"
                };
                for(int i = 0; i < jsonKVP.Length; i++) {
                    if(i % 2 == 0) sb.Append($"\n\t\"{jsonKVP[i]}\":");
                    else{
                        sb.Append($"{jsonKVP[i]}");
                        if(i != jsonKVP.Length - 1) sb.Append(',');
                    }
                }
                sb.Append("\n}");
                records.Add(sb.ToString());
            }

            File.WriteAllText(demonstratorOutputPath, "[" + string.Join(",", records.ToArray()) + "\n]");
        }
    }
}
