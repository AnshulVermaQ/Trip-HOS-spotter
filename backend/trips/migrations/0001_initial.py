# Generated manually for the initial schema.
import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Trip",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("input", models.JSONField()),
                ("plan", models.JSONField()),
                ("route", models.CharField(max_length=255)),
                ("miles", models.PositiveIntegerField()),
                ("days", models.PositiveSmallIntegerField()),
                ("status", models.CharField(default="planned", max_length=20)),
            ],
            options={"ordering": ["-created_at"]},
        )
    ]
