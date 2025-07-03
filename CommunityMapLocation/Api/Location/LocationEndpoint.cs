using DV.Customization;
using DV.HUD;
using DV.Simulation.Cars;
using DV.Utils;
using LocoSim.Implementations;
using System;
using System.Collections.Generic;
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
            if (PlayerManager.Car != null && PlayerManager.Car.IsLoco)
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

            var relevantCars = new Dictionary<TrainCar, CarLocationResponse>();
            foreach(var carEntry in TrainCarRegistry.Instance.logicCarToTrainCar) {
                if(IsLocoActive(carEntry.Value)) {
                    foreach(var trainsetCar in carEntry.Value.trainset.cars) {
                        if(!relevantCars.ContainsKey(trainsetCar))
                            relevantCars.Add(trainsetCar, new CarLocationResponse(trainsetCar));
                        relevantCars[trainsetCar].IsActive = true;
                    }
                }
            }
            if(PlayerManager.Car != null) {
                foreach(var car in PlayerManager.Car.trainset.cars) {
                    if(!relevantCars.ContainsKey(car))
                        relevantCars.Add(car, new CarLocationResponse(car));
                    relevantCars[car].IsPlayer = true;
                }
            }

            return new LocationResponse(PlayerManager.PlayerTransform, reverse)
            {
                Cars = relevantCars.Values.ToArray() ?? Array.Empty<CarLocationResponse>()
            };
        }

        private bool IsLocoActive(TrainCar loco) {
            if(!loco.IsLoco) return false;
            if(string.IsNullOrWhiteSpace(loco.Customization?.electronicsFuseID)) return false;
            if(loco.SimController == null || loco.SimController.simFlow == null | loco.Customization == null) return false;
            if(loco.SimController.simFlow.TryGetFuse(loco.Customization.electronicsFuseID, out Fuse fuse) == true)
                return fuse.State;
            return false;
        }
    }
}
