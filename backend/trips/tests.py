import json
from unittest.mock import patch

from django.test import TestCase, override_settings

from .engine import CYCLE_MINUTES, Planner, Point, create_plan, estimated_trip, thin_geometry


def offline_route_for_test(current, pickup, dropoff):
    return estimated_trip(current, pickup, dropoff, "Test routing stub.")


class PlannerEngineTests(TestCase):
    payload = {
        "currentLocation": "Chicago, IL",
        "pickupLocation": "St. Louis, MO",
        "dropoffLocation": "Phoenix, AZ",
        "cycleUsedHours": 22,
    }

    @patch("trips.engine.route_trip", side_effect=offline_route_for_test)
    def test_plan_has_complete_daily_logs_and_required_stops(self, _route_trip):
        plan = create_plan(self.payload)

        self.assertGreater(plan["totalMiles"], 1000)
        self.assertGreaterEqual(plan["counts"]["rests"], 1)
        self.assertGreaterEqual(plan["counts"]["breaks"], 1)
        self.assertGreaterEqual(plan["counts"]["fuel"], 1)
        for log in plan["logs"]:
            self.assertAlmostEqual(sum(log["totals"].values()), 1440)

    @patch("trips.engine.route_trip", side_effect=offline_route_for_test)
    def test_cycle_exhaustion_inserts_a_restart(self, _route_trip):
        plan = create_plan({**self.payload, "cycleUsedHours": 70})

        self.assertGreaterEqual(plan["counts"]["restarts"], 1)
        self.assertEqual(plan["warnings"][0]["title"], "34-hour restart required")
        self.assertLessEqual(plan["cycleRemainingMinutes"], CYCLE_MINUTES)

    @patch("trips.engine.route_trip", side_effect=offline_route_for_test)
    def test_client_supplied_start_date_is_used_for_logs(self, _route_trip):
        plan = create_plan({**self.payload, "startDate": "2026-10-04"})
        self.assertEqual(plan["startDate"], "2026-10-04")
        self.assertEqual(plan["logs"][0]["date"], "2026-10-04")

    @patch("trips.engine.route_trip", side_effect=offline_route_for_test)
    def test_rolling_history_start_time_and_speed_are_used(self, _route_trip):
        history = [2, 3, 4, 1, 2, 3, 3, 4]
        plan = create_plan({
            **self.payload,
            "cycleUsedHours": sum(history),
            "cycleHistoryHours": history,
            "startTime": "09:30",
            "averageSpeedMph": 50,
        })
        self.assertEqual(plan["input"]["cycleHistoryHours"], history)
        self.assertEqual(plan["input"]["startTime"], "09:30")
        self.assertEqual(plan["input"]["averageSpeedMph"], 50)
        self.assertEqual(plan["events"][0]["end"], 9.5 * 60)

    def test_service_event_does_not_run_past_the_14_hour_window(self):
        planner = Planner(Point("Start", 0, 0), Point("Pickup", 0, 1), Point("Dropoff", 0, 2), [0] * 8, 6 * 60, 55)
        planner.clock = 19.5 * 60
        planner.window_start = 6 * 60
        planner.on_duty("pickup", 60, "Pickup")
        self.assertEqual(planner.events[0]["kind"], "rest")
        self.assertEqual(planner.events[1]["kind"], "pickup")
        self.assertGreaterEqual(planner.events[1]["start"] - planner.events[0]["start"], 10 * 60)

    def test_geometry_is_reduced_without_losing_endpoints(self):
        source = [Point("Route point", float(index), float(index)) for index in range(10_000)]
        reduced = thin_geometry(source)
        self.assertLessEqual(len(reduced), 2500)
        self.assertEqual(reduced[0], source[0])
        self.assertEqual(reduced[-1], source[-1])


class TripApiTests(TestCase):
    payload = {
        "currentLocation": "Chicago, IL",
        "pickupLocation": "St. Louis, MO",
        "dropoffLocation": "Phoenix, AZ",
        "cycleUsedHours": 22,
    }

    @patch("trips.engine.route_trip", side_effect=offline_route_for_test)
    def test_plan_persists_and_logs_are_retrievable(self, _route_trip):
        response = self.client.post("/api/trips/plan/", data=json.dumps(self.payload), content_type="application/json")
        self.assertEqual(response.status_code, 201)
        plan = response.json()
        self.assertIn("id", plan)
        self.assertIn("logs", plan)

        logs = self.client.get(f"/api/trips/{plan['id']}/logs/")
        self.assertEqual(logs.status_code, 200)
        self.assertEqual(logs.json(), plan["logs"])

        history = self.client.get("/api/trips/")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]["id"], plan["id"])

        plan["driverDetails"] = {"driverName": "Alex Morgan"}
        updated = self.client.put(f"/api/trips/{plan['id']}/", data=json.dumps(plan), content_type="application/json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["driverDetails"]["driverName"], "Alex Morgan")

    @patch("trips.engine.route_trip", side_effect=offline_route_for_test)
    def test_invalid_input_returns_400(self, _route_trip):
        response = self.client.post(
            "/api/trips/plan/",
            data=json.dumps({**self.payload, "cycleUsedHours": 71}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("between 0 and 70", response.json()["detail"])

    @override_settings(CORS_ALLOWED_ORIGINS={"https://trip-hos-spotter-r2pf.vercel.app"})
    def test_cors_preflight_is_accepted_for_configured_frontend(self):
        response = self.client.options(
            "/api/trips/plan/",
            HTTP_ORIGIN="https://trip-hos-spotter-r2pf.vercel.app",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response["Access-Control-Allow-Origin"], "https://trip-hos-spotter-r2pf.vercel.app")
        self.assertIn("POST", response["Access-Control-Allow-Methods"])
