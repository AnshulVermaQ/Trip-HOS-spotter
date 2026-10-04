"""Vercel Python function entry point for the Django API."""

from config.wsgi import application

# Vercel's Python runtime discovers this WSGI callable.
app = application
