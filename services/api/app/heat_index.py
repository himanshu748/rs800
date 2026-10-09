"""NWS heat index (Rothfusz regression with Steadman fallback and adjustments).

Source: https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
The heat index assumes shade and light wind. It is a screening value, not WBGT.
"""

import math

CATEGORIES = ["below_caution", "caution", "extreme_caution", "danger", "extreme_danger"]


def c_to_f(c: float) -> float:
    return c * 9 / 5 + 32


def f_to_c(f: float) -> float:
    return (f - 32) * 5 / 9


def heat_index_f(temp_f: float, rh: float) -> float:
    simple = 0.5 * (temp_f + 61.0 + (temp_f - 68.0) * 1.2 + rh * 0.094)
    if (simple + temp_f) / 2 < 80:
        return simple
    t, r = temp_f, rh
    hi = (
        -42.379 + 2.04901523 * t + 10.14333127 * r - 0.22475541 * t * r
        - 0.00683783 * t * t - 0.05481717 * r * r + 0.00122874 * t * t * r
        + 0.00085282 * t * r * r - 0.00000199 * t * t * r * r
    )
    if r < 13 and 80 <= t <= 112:
        hi -= ((13 - r) / 4) * math.sqrt((17 - abs(t - 95)) / 17)
    elif r > 85 and 80 <= t <= 87:
        hi += ((r - 85) / 10) * ((87 - t) / 5)
    return hi


def heat_index_c(temp_c: float, rh: float) -> float:
    return f_to_c(heat_index_f(c_to_f(temp_c), rh))


def category_index(hi_f: float) -> int:
    if hi_f >= 125:
        return 4
    if hi_f >= 103:
        return 3
    if hi_f >= 90:
        return 2
    if hi_f >= 80:
        return 1
    return 0
