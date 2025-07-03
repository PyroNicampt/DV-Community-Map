using DV.OriginShift;
using UnityEngine;

namespace CommunityMapLocation.Api.Location
{
    public class CarLocationResponse
    {
        public CarLocationResponse(TrainCar trainCar)
        {
            IsLoco = trainCar.IsLoco;
            Name = trainCar.name;
            Id = trainCar.ID;
            CarGuid = trainCar.CarGUID;
            Derailed = trainCar.derailed;

            // Probable not needed. Commented to remove additional dll dependency
            //HandbrakePosition = trainCar.brakeSystem.handbrakePosition;

            // TrainCar.Bounds does not seem to represent the actual bounds of the car.
            // Approximate the car length as the distance between the couplers
            Length = (trainCar.FrontCouplerAnchor.AbsolutePosition() - trainCar.RearCouplerAnchor.AbsolutePosition()).magnitude;

            var transform = trainCar.transform.AbsolutePosition();
            X = transform.x;
            Y = transform.y;
            Z = transform.z;

            Rotation = trainCar.transform.rotation.eulerAngles.y * (Mathf.PI / 180);

            Speed = trainCar.rb.velocity.magnitude;

            IsActive = false;
            IsPlayer = false;
        }

        public string Id { get; }
        public string CarGuid { get; }
        public string Name { get; }
        public bool IsLoco { get; }
        //public float HandbrakePosition { get; }

        public float X { get; }
        public float Y { get; }
        public float Z { get; }
        public float Length { get; }
        public float Rotation { get; }
        public float Speed { get; }
        public bool Derailed { get; }
        public bool IsActive { get; set; }
        public bool IsPlayer { get; set; }
    }
}
