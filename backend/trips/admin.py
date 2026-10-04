from django.contrib import admin

from .models import Trip


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "route", "miles", "days", "status")
    search_fields = ("route", "id")
    readonly_fields = ("created_at", "input", "plan")
