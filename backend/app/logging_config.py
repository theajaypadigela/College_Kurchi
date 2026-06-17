"""Central logging configuration.

Replaces ad-hoc `print()` calls with the stdlib `logging` module so output has
levels, timestamps, and logger names, and can be routed/filtered in production
(e.g. shipped to a log aggregator). Call `configure_logging()` once at startup.
"""
from __future__ import annotations

import logging

from .config import settings

_configured = False

LOG_FORMAT = "%(asctime)s %(levelname)-7s %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def configure_logging() -> None:
    """Idempotently configure root logging from settings.log_level."""
    global _configured
    if _configured:
        return
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(level=level, format=LOG_FORMAT, datefmt=DATE_FORMAT)
    # Quiet noisy third-party loggers.
    logging.getLogger("pymongo").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"college_kurchi.{name}")
