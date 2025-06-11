using DV.HUD;
using DV.OriginShift;
using System.Net;
using System.Net.Http;
using UnityEngine;
using UnityModManagerNet;

namespace CommunityMapLocation.Api.Location
{
    public class LocationEndpoint : Endpoint<LocationResponse>
    {
        public override HttpMethod HttpMethod => HttpMethod.Get;

        public override string RoutePattern => "/Location";

        public override LocationResponse Handle(UnityModManager.ModEntry.ModLogger logger, HttpListenerRequest request)
        {
            float angle;

            // If the player is in a loco, we want to get the heading of the loco instead of the play
            if (PlayerManager.Car?.IsLoco == true)
            {
                angle = PlayerManager.Car.transform.rotation.eulerAngles.y;

                // If the loco is in reverse, rotate the direction 180 degrees to match the direction of travel
                if (PlayerManager.Car.interior.GetComponentInChildren<InteriorControlsManager>().TryGetControl(InteriorControlsManager.ControlType.Reverser, out var control) &&
                    control.controlImplBase.Value <= 0.25)
                {
                    angle += 180;
                }
            }
            else
            {
                angle = PlayerManager.PlayerCamera.transform.rotation.eulerAngles.y;
            }

            return new LocationResponse(PlayerManager.PlayerTransform.AbsolutePosition(), angle * Mathf.PI / 180);
        }
    }
}
