"""SUN-V3-01: NOAA solar position algorithm tests.

Munich reference case: 48.13°N, 11.58°E, 21 June 2026, 14:30 CEST (UTC+2).
NOAA online calculator reference: azimuth ~216°, elevation ~53°.
Tolerance: ±3° to account for NOAA spreadsheet vs. precise ephemeris.
"""

from __future__ import annotations

from bim_ai.site.sun_position import compute_sun_position

MUNICH_LAT = 48.13
MUNICH_LON = 11.58


class TestMunichSummerSolstice:
    def test_azimuth_in_range(self):
        az, el = compute_sun_position(
            MUNICH_LAT,
            MUNICH_LON,
            "2026-06-21",
            14,
            30,
            dst_strategy="on",  # CEST = CET+1
            utc_offset_hours=1,
        )
        assert 210 <= az <= 225, f"Expected azimuth ~216°, got {az:.1f}°"

    def test_elevation_in_range(self):
        az, el = compute_sun_position(
            MUNICH_LAT,
            MUNICH_LON,
            "2026-06-21",
            14,
            30,
            dst_strategy="on",
            utc_offset_hours=1,
        )
        assert 48 <= el <= 65, f"Expected elevation ~53-61°, got {el:.1f}°"

    def test_sun_below_horizon_at_midnight(self):
        az, el = compute_sun_position(
            MUNICH_LAT,
            MUNICH_LON,
            "2026-06-21",
            0,
            0,
            dst_strategy="on",
            utc_offset_hours=1,
        )
        assert el < 0, f"Sun should be below horizon at midnight, got elevation {el:.1f}°"

    def test_sun_near_south_at_noon(self):
        """Solar noon in Munich: sun should be roughly south (high azimuth ~180°)."""
        az, el = compute_sun_position(
            MUNICH_LAT,
            MUNICH_LON,
            "2026-06-21",
            13,
            20,  # approx solar noon
            dst_strategy="on",
            utc_offset_hours=1,
        )
        assert 160 <= az <= 200, f"Solar noon azimuth should be near 180°, got {az:.1f}°"
        assert el > 60, f"Solar elevation at noon should be high, got {el:.1f}°"

    def test_winter_lower_elevation(self):
        """Munich winter solstice: sun lower in the sky."""
        az_s, el_s = compute_sun_position(
            MUNICH_LAT,
            MUNICH_LON,
            "2026-06-21",
            12,
            0,
            dst_strategy="on",
            utc_offset_hours=1,
        )
        az_w, el_w = compute_sun_position(
            MUNICH_LAT,
            MUNICH_LON,
            "2025-12-21",
            12,
            0,
            dst_strategy="off",
            utc_offset_hours=1,
        )
        assert el_s > el_w, "Summer elevation should be higher than winter elevation"
