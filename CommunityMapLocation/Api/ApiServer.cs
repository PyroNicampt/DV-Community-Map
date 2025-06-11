using CommunityMapLocation.Config;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using UnityModManagerNet;

namespace CommunityMapLocation.Api
{
    public class ApiServer
    {
        public ApiServer(Settings settings, UnityModManager.ModEntry.ModLogger logger)
        {
            listener = new HttpListener();

            serializerOptions = new JsonSerializerOptions()
            {
                ReferenceHandler = ReferenceHandler.IgnoreCycles,
                IncludeFields = true,
                WriteIndented = true
            };

            this.settings = settings;
            this.logger = logger;
        }

        private static string GetPrefix(int port) => $"http://localhost:{port}/";

        private readonly Settings settings;
        private readonly UnityModManager.ModEntry.ModLogger logger;

        private readonly HttpListener listener;

        private readonly JsonSerializerOptions serializerOptions;

        private readonly List<IEndpoint> endpoints = new List<IEndpoint>();

        public void AutoRegister(Assembly assembly = null)
        {
            if (assembly == null)
            {
                assembly = Assembly.GetExecutingAssembly();
            }

            foreach (var endpointType in assembly.ExportedTypes.Where(t => !t.IsInterface && !t.IsAbstract && typeof(IEndpoint).IsAssignableFrom(t)))
            {
                try
                {
                    endpoints.Add((IEndpoint)Activator.CreateInstance(endpointType));
                }
                catch (Exception ex)
                {
                    logger.Warning($"Could not register endpoint {endpointType.Name}: {ex}");
                }
            }
        }

        public void RegisterEndpoint(IEndpoint endpoint)
        {
            endpoints.Add(endpoint);
        }

        public void Start()
        {
            try
            {
                listener.Prefixes.Add(GetPrefix(settings.Port));
                listener.Start();
                listener.BeginGetContext(HandleConnection, null);
            }
            catch (Exception ex)
            {
                logger.Warning(ex.ToString());
                Stop();
            }
        }

        private void HandleConnection(IAsyncResult ar)
        {
            try
            {
                var context = listener.EndGetContext(ar);

                listener.BeginGetContext(HandleConnection, listener);

                var request = context.Request;
                var response = context.Response;

                var matchedEndpoints = endpoints.Where(e => e.Matches(request.Url) &&
                    (request.HttpMethod == "OPTIONS" || request.HttpMethod.Equals(e.HttpMethod.ToString(), StringComparison.OrdinalIgnoreCase)));

                if (!endpoints.Any())
                {
                    response.StatusCode = (int)HttpStatusCode.NotFound;
                }
                else
                {
                    var methods = matchedEndpoints.Select(e => e.HttpMethod).Distinct();

                    response.AppendHeader("Access-Control-Allow-Origin", settings.RequestSourceType == RequestSourceType.All ? "*" : settings.RequestSource);

                    if (request.HttpMethod == "OPTIONS")
                    {
                        response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Accept, X-Requested-With");
                        response.AddHeader("Access-Control-Allow-Methods", String.Join(", ", methods.Select(m => m.ToString().ToUpper())));
                        response.AddHeader("Access-Control-Max-Age", "1728000");
                    }
                    else
                    {
                        var responseBody = matchedEndpoints.First().Handle(logger, request);

                        var buffer = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(responseBody, serializerOptions));

                        response.ContentLength64 = buffer.Length;
                        response.OutputStream.Write(buffer, 0, buffer.Length);
                    }
                }

                response.OutputStream.Close();
            }
            catch (HttpListenerException)
            {
                // HttpListener is stopping, swallow exception
            }
        }

        public void UpdateSettings()
        {
            var prefix = GetPrefix(settings.Port);

            if (listener.Prefixes.Count != 1 || listener.Prefixes.Single() != prefix)
            {
                listener.Prefixes.Clear();
                listener.Prefixes.Add(prefix);
            }
        }

        public void Stop()
        {
            listener.Stop();
            listener.Prefixes.Clear();
        }
    }
}
