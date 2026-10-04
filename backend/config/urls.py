from django.contrib import admin
from django.urls import path

from trips import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", views.health, name="health"),
    path("api/trips/plan/", views.plan_trip, name="plan-trip"),
    path("api/trips/<str:trip_id>/logs/", views.trip_logs, name="trip-logs"),
    path("api/trips/", views.trip_history, name="trip-history"),
]
