import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Map as MapIcon } from "lucide-react";
import "leaflet/dist/leaflet.css";

import type { EventKind, GeoPoint, TripPlan } from "@/lib/hos/types";
import { Card, CardHeader, kindLabel } from "./ui";

const markerTone: Record<"current" | "pickup" | "delivery" | "stop" | "rest", string> = {
  current: "#1676d2",
  pickup: "#1f9862",
  delivery: "#de3d3d",
  stop: "#db8a00",
  rest: "#7c3fc8",
};

const stopTone: Partial<Record<EventKind, "stop" | "rest">> = {
  fuel: "stop",
  break: "stop",
  rest: "rest",
  restart: "rest",
};

function popupContent(title: string, point: GeoPoint) {
  const element = document.createElement("div");
  const heading = document.createElement("p");
  const body = document.createElement("p");
  heading.className = "leaflet-popup-title";
  heading.textContent = title;
  body.className = "leaflet-popup-body";
  body.textContent = point.name;
  element.append(heading, body);
  return element;
}

function addMarker(
  L: typeof import("leaflet"),
  map: LeafletMap,
  point: GeoPoint,
  tone: keyof typeof markerTone,
  title: string,
  major = false,
) {
  return L
    .circleMarker([point.lat, point.lng], {
      radius: major ? 9 : 7,
      color: "#ffffff",
      weight: 3,
      fillColor: markerTone[tone],
      fillOpacity: 1,
    })
    .bindPopup(popupContent(title, point), { closeButton: true })
    .addTo(map);
}

export function RouteMap({ plan }: { plan: TripPlan }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const { current, pickup, dropoff } = plan.points;
  // A line through only the three stops is an estimate, not a driveable route.
  // Do not render it as a road: wait for the backend's OSRM geometry instead.
  const routePoints = useMemo(
    () => (plan.routingSource === "osrm" && plan.routeGeometry && plan.routeGeometry.length > 2 ? plan.routeGeometry : undefined),
    [plan.routingSource, plan.routeGeometry],
  );
  const hasRoadGeometry = Boolean(routePoints);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | undefined;
    setLoaded(false);

    async function drawMap() {
      const L = await import("leaflet");
      if (cancelled || !mapElement.current) return;

      map = L.map(mapElement.current, { zoomControl: true, scrollWheelZoom: true, preferCanvas: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      let bounds = L.latLngBounds([
        [current.lat, current.lng],
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ]);
      if (routePoints) {
        const coordinates = routePoints.map((point) => [point.lat, point.lng] as [number, number]);
        bounds = L
          .polyline(coordinates, {
            color: "#113d7a",
            weight: 5,
            opacity: 0.94,
            lineCap: "round",
            lineJoin: "round",
            smoothFactor: 0,
          })
          .addTo(map)
          .getBounds();
      }

      addMarker(L, map, current, "current", "Current location", true);
      addMarker(L, map, pickup, "pickup", "Pickup", true);
      addMarker(L, map, dropoff, "delivery", "Delivery", true);

      plan.events.forEach((event) => {
        const tone = stopTone[event.kind];
        if (!tone) return;
        const marker = addMarker(L, map!, event.location, tone, kindLabel[event.kind]);
        bounds.extend(marker.getLatLng());
      });

      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 8, animate: false });
      map.invalidateSize(false);
      setLoaded(true);
    }

    void drawMap();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [plan, current, pickup, dropoff, routePoints]);

  return (
    <Card className="overflow-hidden">
      <CardHeader icon={<MapIcon className="size-4" />} title="Route overview" subtitle={`${current.name} → ${pickup.name} → ${dropoff.name}`} />
      <div className="relative isolate z-0 h-[390px] bg-map-land sm:h-[460px]">
        {!loaded && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading interactive road map…</div>}
        <div ref={mapElement} className="size-full" role="application" aria-label={`Interactive road map from ${current.name} through ${pickup.name} to ${dropoff.name}`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-5 py-2 text-xs">
        {[
          ["bg-marker-current", "Current"],
          ["bg-marker-pickup", "Pickup"],
          ["bg-marker-dropoff", "Delivery"],
          ["bg-marker-stop", "Fuel / Break"],
          ["bg-marker-rest", "Rest"],
        ].map(([color, label]) => (
          <span key={label} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${color}`} />{label}</span>
        ))}
      </div>
      <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
        {plan.routingSource === "osrm" && hasRoadGeometry
          ? "Live road route from OSRM/OpenStreetMap. Zoom, pan, or select a route marker for details."
          : "Road routing is unavailable for this plan. Location markers are shown without an estimated straight line; submit again to request an OSRM road route."}
      </p>
    </Card>
  );
}
