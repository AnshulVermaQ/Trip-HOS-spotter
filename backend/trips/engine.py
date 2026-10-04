"""Deterministic HOS trip-planning engine used by the HTTP API.

This module intentionally keeps the scheduling rules separate from Django views so
the plan and the generated Record of Duty Status (RODS) remain inspectable and
unit-testable.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from functools import lru_cache
import json
import math
import os
from pathlib import Path
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DutyStatus = Literal["OFF", "SB", "D", "ON"]

AVERAGE_SPEED_MPH = 55.0
ROAD_DISTANCE_FACTOR = 1.18
MAX_DRIVING_MINUTES = 11 * 60
DRIVING_WINDOW_MINUTES = 14 * 60
BREAK_AFTER_DRIVING_MINUTES = 8 * 60
BREAK_MINUTES = 30
RESET_MINUTES = 10 * 60
CYCLE_MINUTES = 70 * 60
RESTART_MINUTES = 34 * 60
FUEL_EVERY_MILES = 1000.0
FUEL_MINUTES = 30
HANDLING_MINUTES = 60
TRIP_START_MINUTE = 6 * 60
EPSILON = 1e-6


class PlannerInputError(ValueError):
    pass


@dataclass(frozen=True)
class Point:
    name: str
    lat: float
    lng: float

    def as_dict(self) -> dict[str, float | str]:
        return {"name": self.name, "lat": self.lat, "lng": self.lng}


@dataclass(frozen=True)
class RouteLeg:
    miles: float
    geometry: list[Point]


@dataclass(frozen=True)
class RoutedTrip:
    legs: tuple[RouteLeg, RouteLeg]
    source: Literal["osrm", "estimate"]
    notice: str

    @property
    def geometry(self) -> list[Point]:
        first, second = self.legs
        return first.geometry + second.geometry[1:]


@lru_cache(maxsize=1)
def location_lookup() -> dict[str, Point]:
    data_path = Path(__file__).with_name("data") / "us-locations.json"
    rows = json.loads(data_path.read_text(encoding="utf-8"))
    return {str(name).casefold(): Point(str(name), float(lat), float(lng)) for name, lat, lng in rows}


def find_location(value: object, field_name: str) -> Point:
    if not isinstance(value, str) or not value.strip():
        raise PlannerInputError(f"{field_name} is required.")
    point = location_lookup().get(value.strip().casefold())
    if point is None:
        raise PlannerInputError(f"{field_name} was not found in the US location catalog.")
    return point


def haversine_miles(start: Point, end: Point) -> float:
    radius_miles = 3958.8
    lat_delta = math.radians(end.lat - start.lat)
    lng_delta = math.radians(end.lng - start.lng)
    a = math.sin(lat_delta / 2) ** 2 + math.cos(math.radians(start.lat)) * math.cos(math.radians(end.lat)) * math.sin(lng_delta / 2) ** 2
    return 2 * radius_miles * math.asin(math.sqrt(a))


def road_miles(start: Point, end: Point) -> float:
    """Offline fallback only when the live routing service cannot be reached."""
    return haversine_miles(start, end) * ROAD_DISTANCE_FACTOR


def estimated_trip(current: Point, pickup: Point, dropoff: Point, reason: str) -> RoutedTrip:
    return RoutedTrip(
        legs=(
            RouteLeg(road_miles(current, pickup), [current, pickup]),
            RouteLeg(road_miles(pickup, dropoff), [pickup, dropoff]),
        ),
        source="estimate",
        notice=f"Live road routing was unavailable; using an offline distance estimate. {reason}",
    )


def osrm_leg(start: Point, end: Point) -> RouteLeg:
    """Request driving distance plus GeoJSON route geometry from a configurable OSRM service."""
    base_url = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org").rstrip("/")
    coordinates = f"{start.lng:.6f},{start.lat:.6f};{end.lng:.6f},{end.lat:.6f}"
    # Full geometry preserves the actual road shape for the interactive map;
    # a simplified overview can make long interstate routes look like straight lines.
    url = f"{base_url}/route/v1/driving/{coordinates}?overview=full&geometries=geojson&steps=false"
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "RoadReady-HOS-Planner/1.0"})
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"OSRM request failed: {exc}") from exc
    try:
        if payload.get("code") != "Ok":
            raise RuntimeError(str(payload.get("message") or payload.get("code") or "OSRM returned no route"))
        route = payload["routes"][0]
        coordinates = route["geometry"]["coordinates"]
        geometry = [Point("Route point", float(lat), float(lng)) for lng, lat in coordinates]
        if len(geometry) < 2:
            raise RuntimeError("OSRM returned an incomplete route geometry")
        return RouteLeg(float(route["distance"]) / 1609.344, geometry)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise RuntimeError("OSRM returned an invalid route response") from exc


def route_trip(current: Point, pickup: Point, dropoff: Point) -> RoutedTrip:
    try:
        return RoutedTrip(
            legs=(osrm_leg(current, pickup), osrm_leg(pickup, dropoff)),
            source="osrm",
            notice="Live road distance and route geometry from OSRM/OpenStreetMap.",
        )
    except RuntimeError as exc:
        return estimated_trip(current, pickup, dropoff, str(exc))


def named_point(lat: float, lng: float) -> Point:
    candidate = Point("", lat, lng)
    # A real city label makes generated paper logs materially easier to review.
    nearest = min(location_lookup().values(), key=lambda city: haversine_miles(candidate, city))
    distance = haversine_miles(candidate, nearest)
    name = nearest.name if distance < 15 else f"{round(distance)} mi from {nearest.name}"
    return Point(name, lat, lng)


def point_on_route(route: list[Point], fraction: float) -> Point:
    """Locate an event on the returned road geometry, not a direct endpoint line."""
    if len(route) < 2:
        return route[0]
    fraction = min(1.0, max(0.0, fraction))
    lengths = [haversine_miles(start, end) for start, end in zip(route, route[1:])]
    total = sum(lengths)
    if total <= EPSILON:
        return route[0]
    target = total * fraction
    travelled = 0.0
    for start, end, length in zip(route, route[1:], lengths):
        if travelled + length >= target:
            segment_fraction = (target - travelled) / length if length > EPSILON else 0.0
            return named_point(
                start.lat + (end.lat - start.lat) * segment_fraction,
                start.lng + (end.lng - start.lng) * segment_fraction,
            )
        travelled += length
    return route[-1]


def status_totals(segments: list[dict[str, Any]]) -> dict[str, float]:
    totals = {"OFF": 0.0, "SB": 0.0, "D": 0.0, "ON": 0.0}
    for segment in segments:
        totals[segment["status"]] += segment["end"] - segment["start"]
    return totals


def build_daily_logs(events: list[dict[str, Any]], start_date: date) -> list[dict[str, Any]]:
    final_end = events[-1]["end"] if events else 1440
    day_count = max(1, math.ceil(final_end / 1440))
    logs: list[dict[str, Any]] = []

    for day_index in range(day_count):
        day_start = day_index * 1440
        day_end = day_start + 1440
        segments: list[dict[str, Any]] = []
        remarks: list[dict[str, Any]] = []
        miles = 0.0
        for event in events:
            segment_start = max(event["start"], day_start)
            segment_end = min(event["end"], day_end)
            if segment_end - segment_start <= EPSILON:
                continue
            segment = {"status": event["status"], "start": segment_start - day_start, "end": segment_end - day_start}
            previous = segments[-1] if segments else None
            if previous and previous["status"] == segment["status"] and abs(previous["end"] - segment["start"]) <= EPSILON:
                previous["end"] = segment["end"]
            else:
                segments.append(segment)
            if event.get("miles"):
                miles += event["miles"] * ((segment_end - segment_start) / (event["end"] - event["start"]))
            if day_start - EPSILON <= event["start"] < day_end:
                remarks.append({
                    "time": event["start"] - day_start,
                    "status": event["status"],
                    "location": event["location"]["name"],
                    "note": event["note"],
                })
        logs.append({
            "day": day_index + 1,
            "date": (start_date + timedelta(days=day_index)).isoformat(),
            "segments": segments,
            "remarks": remarks,
            "totals": status_totals(segments),
            "miles": miles,
        })
    return logs


class Planner:
    def __init__(self, current: Point, pickup: Point, dropoff: Point, cycle_used_hours: float):
        self.current = current
        self.pickup = pickup
        self.dropoff = dropoff
        self.position = current
        self.cycle = cycle_used_hours * 60
        self.events: list[dict[str, Any]] = []
        self.clock = 0.0
        self.shift_driving = 0.0
        self.window_start: float | None = None
        self.driving_since_break = 0.0
        self.miles_since_fuel = 0.0

    def add(self, kind: str, status: DutyStatus, duration: float, note: str, *, miles: float | None = None, location: Point | None = None) -> None:
        if duration <= 0:
            return
        event: dict[str, Any] = {
            "id": f"e{len(self.events)}",
            "kind": kind,
            "status": status,
            "start": self.clock,
            "end": self.clock + duration,
            "location": (location or self.position).as_dict(),
            "note": note,
        }
        if miles is not None:
            event["miles"] = miles
        self.events.append(event)
        self.clock += duration

    def reset_daily_limits(self) -> None:
        self.shift_driving = 0.0
        self.window_start = None
        self.driving_since_break = 0.0

    def rest(self) -> None:
        self.add("rest", "SB", RESET_MINUTES, "10-hour qualifying reset (sleeper berth)")
        self.reset_daily_limits()

    def restart(self) -> None:
        self.add("restart", "OFF", RESTART_MINUTES, "34-hour cycle restart (70-hour limit reached)")
        self.cycle = 0.0
        self.reset_daily_limits()

    def on_duty(self, kind: str, duration: float, note: str) -> None:
        if self.cycle + duration > CYCLE_MINUTES + EPSILON:
            self.restart()
        if self.window_start is None:
            self.window_start = self.clock
        self.add(kind, "ON", duration, note)
        self.cycle += duration
        if duration >= BREAK_MINUTES:
            self.driving_since_break = 0.0

    def drive(self, start: Point, end: Point, miles: float, geometry: list[Point]) -> float:
        covered = 0.0
        safety = 0
        while miles - covered > 0.05:
            safety += 1
            if safety > 500:
                raise RuntimeError("The route planner exceeded its safety limit.")
            self.position = point_on_route(geometry, covered / miles)
            if self.window_start is None:
                self.window_start = self.clock
            cycle_left = CYCLE_MINUTES - self.cycle
            driving_left = MAX_DRIVING_MINUTES - self.shift_driving
            window_left = DRIVING_WINDOW_MINUTES - (self.clock - self.window_start)
            break_left = BREAK_AFTER_DRIVING_MINUTES - self.driving_since_break
            fuel_left = ((FUEL_EVERY_MILES - self.miles_since_fuel) / AVERAGE_SPEED_MPH) * 60
            remaining_drive_minutes = ((miles - covered) / AVERAGE_SPEED_MPH) * 60

            if cycle_left <= EPSILON:
                self.restart()
                continue
            if driving_left <= EPSILON or window_left <= EPSILON:
                self.rest()
                continue
            if fuel_left <= 0.5:
                self.on_duty("fuel", FUEL_MINUTES, "Fueling stop (also satisfies 30-minute break)")
                self.miles_since_fuel = 0.0
                continue
            if break_left <= EPSILON:
                self.add("break", "OFF", BREAK_MINUTES, "30-minute break after 8 cumulative driving hours")
                self.driving_since_break = 0.0
                continue

            duration = min(cycle_left, driving_left, window_left, break_left, fuel_left, remaining_drive_minutes)
            segment_miles = duration / 60 * AVERAGE_SPEED_MPH
            self.add("drive", "D", duration, f"Driving toward {end.name}", miles=segment_miles)
            covered += segment_miles
            self.shift_driving += duration
            self.driving_since_break += duration
            self.miles_since_fuel += segment_miles
            self.cycle += duration
        self.position = end
        return miles


def validate_input(payload: object) -> tuple[Point, Point, Point, float, dict[str, Any]]:
    if not isinstance(payload, dict):
        raise PlannerInputError("Expected a JSON object.")
    current = find_location(payload.get("currentLocation"), "Current location")
    pickup = find_location(payload.get("pickupLocation"), "Pickup location")
    dropoff = find_location(payload.get("dropoffLocation"), "Dropoff location")
    cycle_value = payload.get("cycleUsedHours")
    if isinstance(cycle_value, bool) or not isinstance(cycle_value, (int, float)) or not math.isfinite(cycle_value):
        raise PlannerInputError("Current cycle used must be a number between 0 and 70.")
    cycle_used = float(cycle_value)
    if not 0 <= cycle_used <= 70:
        raise PlannerInputError("Current cycle used must be between 0 and 70.")
    normalized = {
        "currentLocation": current.name,
        "pickupLocation": pickup.name,
        "dropoffLocation": dropoff.name,
        "cycleUsedHours": cycle_used,
    }
    return current, pickup, dropoff, cycle_used, normalized


def create_plan(payload: object, *, start_date: date | None = None) -> dict[str, Any]:
    current, pickup, dropoff, cycle_used, normalized_input = validate_input(payload)
    routed_trip = route_trip(current, pickup, dropoff)
    planner = Planner(current, pickup, dropoff, cycle_used)
    planner.add("prior", "OFF", TRIP_START_MINUTE, "Off duty - prior reset completed")
    trip_start = planner.clock
    miles_to_pickup = planner.drive(current, pickup, routed_trip.legs[0].miles, routed_trip.legs[0].geometry)
    planner.on_duty("pickup", HANDLING_MINUTES, "Pickup - loading at shipper")
    miles_to_dropoff = planner.drive(pickup, dropoff, routed_trip.legs[1].miles, routed_trip.legs[1].geometry)
    planner.on_duty("dropoff", HANDLING_MINUTES, "Dropoff - unloading at receiver")
    trip_end = planner.clock
    end_of_day = math.ceil(planner.clock / 1440) * 1440
    if end_of_day - planner.clock > EPSILON:
        planner.add("end", "OFF", end_of_day - planner.clock, "Off duty - trip complete")

    events = planner.events
    total_miles = miles_to_pickup + miles_to_dropoff
    count = lambda kind: sum(1 for event in events if event["kind"] == kind)
    counts = {
        "breaks": count("break") + count("fuel"),
        "fuel": count("fuel"),
        "rests": count("rest"),
        "restarts": count("restart"),
    }
    cycle_remaining = max(0.0, CYCLE_MINUTES - planner.cycle)
    warnings: list[dict[str, str]] = [{
        "level": "info",
        "title": "Rolling 8-day availability",
        "message": "Cycle hours are modeled from the entered baseline. Actual rolling availability requires historical duty records.",
    }]
    if routed_trip.source == "estimate":
        warnings.insert(0, {"level": "warning", "title": "Offline route estimate", "message": routed_trip.notice})
    if counts["restarts"]:
        warnings.insert(0, {
            "level": "critical",
            "title": "34-hour restart required",
            "message": f"Available cycle time ({70 - cycle_used:.1f} h) is insufficient; the plan includes {counts['restarts']} 34-hour restart(s).",
        })
    elif cycle_remaining < BREAK_AFTER_DRIVING_MINUTES:
        warnings.insert(0, {
            "level": "warning",
            "title": "Low cycle availability after delivery",
            "message": f"Only {cycle_remaining / 60:.1f} h of the modeled 70-hour cycle remain after this trip.",
        })
    else:
        warnings.insert(0, {
            "level": "ok",
            "title": "Modeled HOS limits satisfied",
            "message": "The planned schedule fits the modeled driving, break, duty-window, and cycle constraints.",
        })

    plan_start_date = start_date or date.today()
    return {
        "input": normalized_input,
        "startDate": plan_start_date.isoformat(),
        "points": {"current": current.as_dict(), "pickup": pickup.as_dict(), "dropoff": dropoff.as_dict()},
        "routeGeometry": [point.as_dict() for point in routed_trip.geometry],
        "routingSource": routed_trip.source,
        "routingNotice": routed_trip.notice,
        "totalMiles": total_miles,
        "legMiles": {"toPickup": miles_to_pickup, "toDropoff": miles_to_dropoff},
        "drivingMinutes": sum(event["end"] - event["start"] for event in events if event["status"] == "D"),
        "onDutyMinutes": sum(event["end"] - event["start"] for event in events if event["status"] == "ON"),
        "handlingMinutes": HANDLING_MINUTES * 2,
        "tripMinutes": trip_end - trip_start,
        "events": events,
        "logs": build_daily_logs(events, plan_start_date),
        "counts": counts,
        "cycleRemainingMinutes": cycle_remaining,
        "warnings": warnings,
    }
