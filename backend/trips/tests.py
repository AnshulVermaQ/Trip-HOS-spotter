import json
from unittest.mock import patch

from django.test import TestCase

from .engine import CYCLE_MINUTES, create_plan, estimated_trip


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

    @patch("trips.engine.route_trip", side_effect=offline_route_for_test)
    def test_invalid_input_returns_400(self, _route_trip):
        response = self.client.post(
            "/api/trips/plan/",
            data=json.dumps({**self.payload, "cycleUsedHours": 71}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("between 0 and 70", response.json()["detail"])
