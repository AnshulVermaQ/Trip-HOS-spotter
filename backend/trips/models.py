import uuid

from django.db import models


class Trip(models.Model):
    """An auditable snapshot of one generated plan and its ELD log output."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    input = models.JSONField()
    plan = models.JSONField()
    route = models.CharField(max_length=255)
    miles = models.PositiveIntegerField()
    days = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=20, default="planned")

    class Meta:
        ordering = ["-created_at"]
