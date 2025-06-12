using DV.OriginShift;
using System.Collections.Generic;
using UnityEngine;

namespace CommunityMapLocation.Api.Location
{
    public class LocationResponse
    {
        public LocationResponse(Transform playerTransform, bool reverse)
        {
            var position = playerTransform.AbsolutePosition();

            X = position.x;
            Y = position.y;
            Z = position.z;

            var angle = playerTransform.rotation.eulerAngles.y;

            if (reverse)
            {
                angle += 180;
            }

            Rotation = angle * (Mathf.PI / 180);
        }

        public float X { get; }
        public float Y { get; }
        public float Z { get; }
        public float Rotation { get; }

        public IEnumerable<CarLocationResponse> Cars { get; set; }
    }
}
