using DV.HUD;
using System;
using System.Linq;
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
            Transform rotationTransform;
            var reverse = false;

            // If the player is in a loco, we want to get the heading of the loco instead of the play
            if (PlayerManager.Car?.IsLoco == true)
            {
                rotationTransform = PlayerManager.Car.transform;

                // If the loco is in reverse, rotate the direction 180 degrees to match the direction of travel
                if (PlayerManager.Car.interior.GetComponentInChildren<InteriorControlsManager>().TryGetControl(InteriorControlsManager.ControlType.Reverser, out var control) &&
                    control.controlImplBase.Value <= 0.25)
                {
                    reverse = true;
                }
            }
            else
            {
                rotationTransform = PlayerManager.PlayerCamera.transform;
            }

            var cars = Array.Empty<CarLocationResponse>();
            if (PlayerManager.Car != null)
            {
                cars = PlayerManager.Car.trainset.cars.Select(c => new CarLocationResponse(c)).ToArray();
            }

            return new LocationResponse(PlayerManager.PlayerTransform, reverse)
            {
                Cars = cars
            };
        }
    }
}
