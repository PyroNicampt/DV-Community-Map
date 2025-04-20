using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityModManagerNet;
using DV.LocoRestoration;
using DV.OriginShift;
using DV.Shops;
using DV.Utils;
using DV.UserManagement;

namespace CommunityMapTool {
    [EnableReloading]
    static class Main {
        private static string trackOutputPath = "map_dump.json";
        private static string demonstratorOutputPath = "demo_dump.json";
        private static string shopOutputPath = "shop_dump.json";
        private static string statusText = "";
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
            if(PlayerManager.PlayerTransform != null) GUILayout.Label($"Player Position: {PlayerManager.PlayerTransform.AbsolutePosition()}");
            GUILayout.Label($"WorldMover offset: {OriginShift.currentMove}");
            if(GUILayout.Button("Dump All Tracks")) DumpAllTracks();
            if(GUILayout.Button("Dump Demonstrator Spawnpoints")) DemonstratorDump();
            if(GUILayout.Button("Dump Shop Inventories")) DumpShopItems();
            if(GUILayout.Button("Copy Position To Clipboard")) ClipboardPlayerPosition();
            if(statusText != "") GUILayout.Label(statusText);
        }

        static void ClipboardPlayerPosition() {
            if(PlayerManager.PlayerTransform == null) return;
            Vector3 pos = PlayerManager.PlayerTransform.AbsolutePosition();
            GUIUtility.systemCopyBuffer = $"{{\"x\":{pos.x},\"y\":{pos.y},\"z\":{pos.z}}}";
            statusText = $"Copied \"{GUIUtility.systemCopyBuffer}\" to clipboard";
        }
        static void DumpAllTracks() {
            List<string> records = new List<string>();
            RailTrackRegistry registry = UnityEngine.Object.FindObjectOfType<RailTrackRegistry>();
            if(registry == null) {
                statusText = "Could not find RailtrackRegistry";
                return;
            }
            foreach(RailTrack railTrack in registry.OrderedRailtracks) {
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
                    sb.Append($"\"position\":{{\"x\":{point.position.x - OriginShift.currentMove.x},\"y\":{point.position.y - OriginShift.currentMove.y},\"z\":{point.position.z - OriginShift.currentMove.z}}}, ");
                    sb.Append($"\"h1\":{{\"x\":{point.globalHandle1.x - OriginShift.currentMove.x},\"y\":{point.globalHandle1.y - OriginShift.currentMove.y},\"z\":{point.globalHandle1.z - OriginShift.currentMove.z}}}, ");
                    sb.Append($"\"h2\":{{\"x\":{point.globalHandle2.x - OriginShift.currentMove.x},\"y\":{point.globalHandle2.y - OriginShift.currentMove.y},\"z\":{point.globalHandle2.z - OriginShift.currentMove.z}}}, ");
                    sb.Append($"\"type\":\"{point.handleStyle}\"");
                    sb.Append(i + 1 < railTrack.curve.pointCount ? "}," : "}");
                }
                sb.Append("\n\t]\n}");
                records.Add(sb.ToString());
            }
            foreach(Junction junction in registry.OrderedJunctions) {
                StringBuilder sb = new StringBuilder();

                string[] baseJunctionData = new[] {
                    "type", "\"junction\"",
                    "name", $"\"{junction.junctionData.junctionIdLong}\"",
                    "position", $"{{\"x\":{junction.junctionData.position.x},\"y\":{junction.junctionData.position.y},\"z\":{junction.junctionData.position.z}}}",
                    "excludeFromJunctionMap", junction.junctionData.excludeFromJunctionMap ? "true" : "false",
                    "isValid", junction.junctionData.isValid ? "true" : "false",
                    "linkedJunctions", $"[{string.Join(", ", junction.junctionData.linkedJunctions)}]",
                    "index", junction.junctionData.junctionIndex.ToString(),
                    "id", junction.junctionData.junctionId.ToString()
                };
                sb.Append("\n{");
                for(int i = 0; i < baseJunctionData.Length; i++) {
                    if(i % 2 == 0) sb.Append($"\n\t\"{baseJunctionData[i]}\":");
                    else {
                        sb.Append($"{baseJunctionData[i]}");
                        if(i < baseJunctionData.Length - 1) sb.Append(",");
                    }
                }
                sb.Append("\n}");
                records.Add(sb.ToString());
            }
            File.WriteAllText(trackOutputPath, "[" + string.Join(",", records.ToArray()) + "\n]");
            statusText = $"Dumped to {trackOutputPath}";
        }
        static void DumpShopItems() {
            GlobalShopController shopController = UnityEngine.Object.FindObjectOfType<GlobalShopController>();
            if(shopController == null) {
                statusText = "Could not find GlobalShopController";
                return;
            }
            if(SingletonBehaviour<UserManager>.Instance.CurrentUser.CurrentSession.GameMode != "Career") {
                statusText = "Cannot dump shop prices in sandbox";
                return;
            }
            List<string> records = new List<string>();
            foreach(ShopItemData shopItem in shopController.shopItemsData) {
                string[] soldAtShops = new string[shopItem.soldOnlyAt.Count];
                for(int i = 0; i < soldAtShops.Length; i++) {
                    soldAtShops[i] = "\"" + shopItem.soldOnlyAt[i].name.Replace("[ItemShop] ","").Replace(" (Shop)","") + "\"";
                }
                records.Add(jsonKVPToString(new string[] {
                    "name", $"\"{shopItem.item.LocalizedName}\"",
                    "price", $"{shopItem.basePrice}",
                    "count", $"{shopItem.allowedToHaveAmount}",
                    "soldOnlyAt", soldAtShops.Length > 0 ? $"[\n\t\t{string.Join(",\n\t\t", soldAtShops)}\n\t]" : "[]"
                }));
            }
            File.WriteAllText(shopOutputPath, "[" + string.Join(",", records.ToArray()) + "\n]");
            statusText = $"Dumped to {shopOutputPath}";
        }
        static void DemonstratorDump() {
            List<string> records = new List<string>();
            foreach(LocoRestorationSpawnPoint spawnPoint in UnityEngine.Object.FindObjectsOfType<LocoRestorationSpawnPoint>()) {
                records.Add(jsonKVPToString(new string[] {
                    "name", $"\"{spawnPoint.name}\"",
                    "type", $"\"demonstratorSpawn\"",
                    "position", $"{{\"x\":{spawnPoint.transform.position.x - OriginShift.currentMove.x},\"y\":{spawnPoint.transform.position.y - OriginShift.currentMove.y},\"z\":{spawnPoint.transform.position.z - OriginShift.currentMove.z}}}"
                }));
            }

            File.WriteAllText(demonstratorOutputPath, "[" + string.Join(",", records.ToArray()) + "\n]");
            statusText = $"Dumped to {demonstratorOutputPath}";
        }

        static string jsonKVPToString(string[] jsonKVP) {
            StringBuilder sb = new StringBuilder();
            sb.Append("\n{");
            for(int i = 0; i < jsonKVP.Length; i++) {
                if(i % 2 == 0) sb.Append($"\n\t\"{jsonKVP[i]}\":");
                else {
                    sb.Append($"{jsonKVP[i]}");
                    if(i != jsonKVP.Length - 1) sb.Append(',');
                }
            }
            sb.Append("\n}");
            return sb.ToString();
        }
    }
}
