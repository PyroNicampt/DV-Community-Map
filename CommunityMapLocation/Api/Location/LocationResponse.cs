using UnityEngine;

namespace CommunityMapLocation.Api.Location
{
    public class LocationResponse
    {
        public LocationResponse(Vector3 position, float rotation)
        {
            X = position.x;
            Y = position.y;
            Z = position.z;

            Rotation = rotation;
        }

        public float X { get; }
        public float Y { get; }
        public float Z { get; }
        public float Rotation { get; }
    }
}
