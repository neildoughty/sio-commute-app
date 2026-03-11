// ─────────────────────────────────────────────────────────────
//  COMMUTE DASHBOARD — CONFIGURATION
//
//  TfL API key        → https://api.tfl.gov.uk
//  Darwin key         → https://realtime.nationalrail.co.uk/OpenLDBWSRegistration
//  Football-data key  → https://www.football-data.org (free tier)
//
//  Leave any key as '' to use mock/demo data for that source.
// ─────────────────────────────────────────────────────────────

const CONFIG = {
  // ── TfL (Tube live arrivals & line status) ──────────────────
  TFL_API_KEY: '02e88706659947e180fefaecb043005b',

  // ── Darwin / National Rail (Great Northern live departures) ─
  DARWIN_API_KEY: 'G5MuS7ylCzLo1GBCUgsDl1UFxzquHGXmQG9uhrJTITIRGrai',  // raildata.org.uk LDBWS key

  // ── Football fixtures (Arsenal & Spurs home games) ──────────
  //   Register free at https://www.football-data.org/client/register
  FOOTBALL_API_KEY: '305c4f5e202d4c2293c07678c9c9655e',     

  // ── Station CRS codes (National Rail) ───────────────────────
  CRS_BOWES_PARK: 'BOP',
  CRS_HIGHBURY:   'HHY',

  // ── Behaviour ────────────────────────────────────────────────
  EVENING_HOUR: 14,             // auto-flip to evening mode after this hour
  CONNECTION_BUFFER_MINS: 2,    // minimum spare mins needed at H&I interchange

  // Walk times from office (W1 1AA) to each board point (mins)
  WALK_TO_OXC: 5,               // to Oxford Circus
  WALK_TO_WRR: 11,              // to Warren Street (longer walk, one stop closer)
  MORNING_TARGET_TRAIN: '07:25',
  REFRESH_INTERVAL_MS: 60000,   // live data refresh interval (ms)
};
