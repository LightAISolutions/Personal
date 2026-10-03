'use strict';
// A recorded Open-Meteo answer for the Phase 12 rehearsal (WP-12r): the geocoding and forecast shapes the coordinator
// recorded on 2026-10-03 (TG-PHASE-12 §2), with invented towns (the rehearsal-day fixture's Quillmere and Tarnwick, user-
// assigned country code ZZ), invented coordinates and invented weather for the moving day 2027-11-09. Nothing here is a
// real place or forecast. Not a test file: pack_tour-guide_phase12_rehearsal.test.js requires it.
const TZ = 'Etc/GMT+10';
const DATE = '2027-11-09';
const hours = Array.from({ length: 24 }, (_, h) => DATE + 'T' + String(h).padStart(2, '0') + ':00');

/** Geocoding answers by the lower-case `name` asked for. */
const GEOCODE = {
  quillmere: { results: [{ id: 9910001, name: 'Quillmere', latitude: 18.6, longitude: -148.4, elevation: 6, feature_code: 'PPL',
    country_code: 'ZZ', admin1: 'Fictional Isles', timezone: TZ, population: 4200 }], generationtime_ms: 0.4 },
  tarnwick: { results: [{ id: 9910002, name: 'Tarnwick', latitude: 18.645, longitude: -148.37, elevation: 12, feature_code: 'PPL',
    country_code: 'ZZ', admin1: 'Fictional Isles', timezone: TZ, population: 2600 }], generationtime_ms: 0.4 }
};
/** Forecast answers for 2027-11-09 by latitude: Quillmere dry in the morning, Tarnwick showers from 16:00. */
const FORECAST = {
  18.6: { latitude: 18.6, longitude: -148.4, generationtime_ms: 0.2, utc_offset_seconds: -36000, timezone: TZ, timezone_abbreviation: 'GMT-10',
    elevation: 6, daily_units: { time: 'iso8601', weather_code: 'wmo code', temperature_2m_max: '°C', temperature_2m_min: '°C', precipitation_probability_max: '%' },
    daily: { time: [DATE], weather_code: [2], temperature_2m_max: [27.4], temperature_2m_min: [21.2], precipitation_probability_max: [20] },
    hourly_units: { time: 'iso8601', precipitation_probability: '%' },
    hourly: { time: hours, precipitation_probability: hours.map((_, h) => (h < 14 ? 5 : 20)) } },
  18.645: { latitude: 18.645, longitude: -148.37, generationtime_ms: 0.2, utc_offset_seconds: -36000, timezone: TZ, timezone_abbreviation: 'GMT-10',
    elevation: 12, daily_units: { time: 'iso8601', weather_code: 'wmo code', temperature_2m_max: '°C', temperature_2m_min: '°C', precipitation_probability_max: '%' },
    daily: { time: [DATE], weather_code: [80], temperature_2m_max: [26.6], temperature_2m_min: [20.8], precipitation_probability_max: [70] },
    hourly_units: { time: 'iso8601', precipitation_probability: '%' },
    hourly: { time: hours, precipitation_probability: hours.map((_, h) => (h < 16 ? 10 : 70)) } }
};

/** A fetch responder that answers the two Open-Meteo hosts from the recording; anything else falls through (null). */
function responder() {
  return (url) => {
    if (url.startsWith('https://geocoding-api.open-meteo.com/')) {
      const name = decodeURIComponent((/[?&]name=([^&]*)/.exec(url) || [])[1] || '').toLowerCase();
      return { code: 200, body: GEOCODE[name] || { generationtime_ms: 0.4 } };
    }
    if (url.startsWith('https://api.open-meteo.com/')) {
      const lat = (/latitude=([^&]*)/.exec(url) || [])[1], date = (/start_date=([^&]*)/.exec(url) || [])[1];
      const f = FORECAST[Number(lat)];
      return f && date === DATE ? { code: 200, body: f }
        : { code: 400, body: { error: true, reason: "Parameter 'start_date' is out of allowed range" } };
    }
    return null;
  };
}

module.exports = { TZ, DATE, GEOCODE, FORECAST, responder };

// Developed by: LightAISolutions
