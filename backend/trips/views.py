import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .engine import PlannerInputError, create_plan
from .models import Trip


def error(message: str, status: int) -> JsonResponse:
    return JsonResponse({"detail": message}, status=status)


@require_GET
def health(_: HttpRequest) -> JsonResponse:
    return JsonResponse({"status": "ok"})


@csrf_exempt
@require_POST
def plan_trip(request: HttpRequest) -> JsonResponse:
    try:
        payload = json.loads(request.body)
    except (TypeError, UnicodeDecodeError, json.JSONDecodeError):
        return error("Request body must contain valid JSON.", 400)
    try:
        plan = create_plan(payload)
    except PlannerInputError as exc:
        return error(str(exc), 400)
    trip = Trip.objects.create(
        input=plan["input"],
        plan=plan,
        route=f"{plan['points']['current']['name']} → {plan['points']['dropoff']['name']}",
        miles=round(plan["totalMiles"]),
        days=len(plan["logs"]),
    )
    plan["id"] = str(trip.id)
    # Persist exactly the contract returned to the frontend, including its ID.
    trip.plan = plan
    trip.save(update_fields=["plan"])
    return JsonResponse(plan, status=201)


@require_GET
def trip_logs(_: HttpRequest, trip_id: str) -> JsonResponse:
    try:
        trip = Trip.objects.get(pk=trip_id)
    except (Trip.DoesNotExist, ValueError):
        return error("Trip not found.", 404)
    return JsonResponse(trip.plan["logs"], safe=False)


@csrf_exempt
@require_http_methods(["PUT"])
def update_trip(request: HttpRequest, trip_id: str) -> JsonResponse:
    try:
        trip = Trip.objects.get(pk=trip_id)
    except (Trip.DoesNotExist, ValueError):
        return error("Trip not found.", 404)
    try:
        plan = json.loads(request.body)
    except (TypeError, UnicodeDecodeError, json.JSONDecodeError):
        return error("Request body must contain valid JSON.", 400)
    if not isinstance(plan, dict) or not isinstance(plan.get("events"), list) or not isinstance(plan.get("logs"), list):
        return error("A complete trip plan with events and logs is required.", 400)
    if str(plan.get("id")) != str(trip.id):
        return error("Trip ID does not match the requested trip.", 400)
    trip.plan = plan
    trip.input = plan.get("input", trip.input)
    trip.miles = round(float(plan.get("totalMiles", trip.miles)))
    trip.days = len(plan["logs"])
    trip.save(update_fields=["plan", "input", "miles", "days"])
    return JsonResponse(plan)


@require_GET
def trip_history(_: HttpRequest) -> JsonResponse:
    history = [{
        "id": str(trip.id),
        "date": trip.created_at.date().isoformat(),
        "route": trip.route,
        "miles": trip.miles,
        "days": trip.days,
        "status": trip.status,
    } for trip in Trip.objects.all()]
    return JsonResponse(history, safe=False)
