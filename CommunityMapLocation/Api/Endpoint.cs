using System;
using System.Net;
using System.Net.Http;
using UnityModManagerNet;

namespace CommunityMapLocation.Api
{
    public abstract class Endpoint<T> : IEndpoint
    {
        public abstract HttpMethod HttpMethod { get; }
        public abstract string RoutePattern { get; }
        public bool Matches(Uri uri)
        {
            return String.Concat(uri.Segments).Equals(RoutePattern, StringComparison.OrdinalIgnoreCase);
        }

        public abstract T Handle(UnityModManager.ModEntry.ModLogger logger, HttpListenerRequest request);

        object IEndpoint.Handle(UnityModManager.ModEntry.ModLogger logger, HttpListenerRequest request)
        {
            return Handle(logger, request);
        }
    }
}
