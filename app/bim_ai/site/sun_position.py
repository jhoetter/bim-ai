"""SUN-V3-01: NOAA solar position algorithm — pure Python, no external dependencies.

Public API
----------
compute_sun_position(lat_deg, lon_deg, date_iso, hours, minutes,
                     dst_strategy="auto", utc_offset_hours=None)
    -> (azimuth_deg, elevation_deg)

Reference: NOAA Solar Calculator spreadsheet (deterministic).
Expected: Munich 48.13°N, 11.58°E, 21 June, 14:30 CEST → ~216° az, ~53° el.
"""

from __future__ import annotations

import math


def _julian_day(year: int, month: int, day: int, ut_hours: float) -> float:
    """Compute Julian Day Number for a Gregorian calendar date + UT hours."""
    if month <= 2:
        year -= 1
        month += 12
    A = math.floor(year / 100)
    B = 2 - A + math.floor(A / 4)
    return (
        math.floor(365.25 * (year + 4716))
        + math.floor(30.6001 * (month + 1))
        + day
        + ut_hours / 24
        + B
        - 1524.5
    )


def compute_sun_position(
    lat_deg: float,
    lon_deg: float,
    date_iso: str,  # YYYY-MM-DD
    hours: int,
    minutes: int,
    dst_strategy: str = "auto",  # "auto" | "on" | "off"
    utc_offset_hours: float | None = None,  # if None, derived from longitude
) -> tuple[float, float]:  # (azimuth_deg, elevation_deg)
    """Compute solar azimuth and corrected elevation using the NOAA algorithm.

    Parameters
    ----------
    lat_deg: Latitude in decimal degrees (negative = south).
    lon_deg: Longitude in decimal degrees (negative = west).
    date_iso: Date string in YYYY-MM-DD format.
    hours: Local clock hour (0–23).
    minutes: Local clock minute (0–59).
    dst_strategy: "auto" applies a simplified hemisphere-based DST rule,
        "on" always adds 1 h, "off" never adds DST.
    utc_offset_hours: Standard UTC offset in hours. If None, approximated
        as round(lon_deg / 15).

    Returns
    -------
    (azimuth_deg, elevation_deg) — azimuth measured clockwise from north,
    elevation corrected for atmospheric refraction.
    """
    year, month, day = map(int, date_iso.split("-"))

    # Derive UTC offset from longitude if not provided.
    if utc_offset_hours is None:
        utc_offset_hours = round(lon_deg / 15.0)

    # Apply DST adjustment.
    dst_hours = 0
    if dst_strategy == "on":
        dst_hours = 1
    elif dst_strategy == "auto":
        # Northern hemisphere: DST roughly March–October (simplified).
        if lat_deg >= 0 and 3 <= month <= 10:
            dst_hours = 1
        # Southern hemisphere: DST roughly September–April (simplified).
        elif lat_deg < 0 and (month >= 9 or month <= 4):
            dst_hours = 1

    # Convert local time to UT, normalised to [0, 24).
    local_hours = hours + minutes / 60.0
    ut_hours = (local_hours - utc_offset_hours - dst_hours) % 24

    jd = _julian_day(year, month, day, ut_hours)

    # Julian Century from J2000.0.
    T = (jd - 2451545.0) / 36525.0

    # Geometric Mean Longitude of the Sun (degrees).
    L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360

    # Geometric Mean Anomaly of the Sun (degrees).
    M = 357.52911 + T * (35999.05029 - 0.0001537 * T)

    # Earth Orbit Eccentricity.
    e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)

    # Sun's Equation of Center.
    M_rad = math.radians(M)
    C = (
        (1.914602 - T * (0.004817 + 0.000014 * T)) * math.sin(M_rad)
        + (0.019993 - 0.000101 * T) * math.sin(2 * M_rad)
        + 0.000289 * math.sin(3 * M_rad)
    )

    # Sun's True Longitude.
    sun_lon = L0 + C

    # Sun's Apparent Longitude (aberration + nutation).
    omega = 125.04 - 1934.136 * T
    apparent_lon = sun_lon - 0.00569 - 0.00478 * math.sin(math.radians(omega))

    # Mean Obliquity of Ecliptic.
    mean_obliq = 23 + (
        26 + (21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813))) / 60
    ) / 60

    # Corrected Obliquity.
    obliq_corr = mean_obliq + 0.00256 * math.cos(math.radians(omega))

    # Sun's Declination.
    declination = math.degrees(
        math.asin(
            math.sin(math.radians(obliq_corr)) * math.sin(math.radians(apparent_lon))
        )
    )

    # Equation of Time (minutes).
    y = math.tan(math.radians(obliq_corr / 2)) ** 2
    L0_rad = math.radians(L0)
    M_rad2 = math.radians(M)
    eot = 4 * math.degrees(
        y * math.sin(2 * L0_rad)
        - 2 * e * math.sin(M_rad2)
        + 4 * e * y * math.sin(M_rad2) * math.cos(2 * L0_rad)
        - 0.5 * y * y * math.sin(4 * L0_rad)
        - 1.25 * e * e * math.sin(2 * M_rad2)
    )

    # True Solar Time (minutes).
    true_solar_time = (ut_hours * 60 + eot + 4 * lon_deg) % 1440

    # Hour Angle (degrees).
    if true_solar_time / 4 < 0:
        hour_angle = true_solar_time / 4 + 180
    else:
        hour_angle = true_solar_time / 4 - 180

    # Solar Zenith Angle.
    lat_rad = math.radians(lat_deg)
    decl_rad = math.radians(declination)
    ha_rad = math.radians(hour_angle)
    cos_zenith = math.sin(lat_rad) * math.sin(decl_rad) + math.cos(lat_rad) * math.cos(
        decl_rad
    ) * math.cos(ha_rad)
    cos_zenith = max(-1.0, min(1.0, cos_zenith))
    zenith = math.degrees(math.acos(cos_zenith))

    # Solar Elevation (before atmospheric refraction correction).
    elevation = 90 - zenith

    # Atmospheric refraction correction (approximate).
    if elevation > 85:
        refraction = 0.0
    elif elevation > 5:
        refraction = (
            58.1 / math.tan(math.radians(elevation))
            - 0.07 / math.tan(math.radians(elevation)) ** 3
            + 0.000086 / math.tan(math.radians(elevation)) ** 5
        ) / 3600
    elif elevation > -0.575:
        refraction = (
            1735
            + elevation
            * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)))
        ) / 3600
    else:
        refraction = -20.772 / math.tan(math.radians(elevation)) / 3600

    elevation_corrected = elevation + refraction

    # Solar Azimuth (degrees, clockwise from north).
    cos_az_num = math.sin(lat_rad) * math.cos(math.radians(zenith)) - math.sin(decl_rad)
    cos_az_den = math.cos(lat_rad) * math.sin(math.radians(zenith))

    if abs(cos_az_den) < 1e-10:
        azimuth = 0.0
    else:
        cos_az = max(-1.0, min(1.0, cos_az_num / cos_az_den))
        azimuth_raw = math.degrees(math.acos(cos_az))
        if hour_angle > 0:
            azimuth = (azimuth_raw + 180) % 360
        else:
            azimuth = (540 - azimuth_raw) % 360

    return azimuth, elevation_corrected
