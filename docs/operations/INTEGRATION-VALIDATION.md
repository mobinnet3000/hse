# HSE Guard — External Integrations & Adapter Validation Runbook

This runbook specifies the provider-neutral architecture, diagnostic status probes, error fallbacks, and validation procedures for HSE Guard's external integration adapters.

---

## 1. Provider-Neutral Integration Architecture

HSE Guard decouples external third-party communication services from core business logic via service adapters.
Each adapter conforms to a standardized lifecycle interface:
- **`is_configured()`**: Checks whether required endpoint URLs and credentials are provided in the environment.
- **`health_check()`**: Returns a standardized diagnostic tuple: `(status: Status, message: str, latency_ms: float)`.
- **Fail-Safe Fallback**: If an external provider is unreachable or unconfigured, the system degrades gracefully without crashing core workflows.

```
       +---------------------------------------------+
       |             HSE Guard Core Engine           |
       |  (PTW, Lifting Plans, Incidents, Alerts)   |
       +----------------------+----------------------+
                              |
                     Standard Adapter API
                              |
       +----------------------+----------------------+
       |           External Adapter Layer            |
       +--------+------------+------------+----------+
                |            |            |
         +------+----+  +----+-----+  +---+--------+
         | SMS Panel |  | Weather  |  | IoT / MQTT |
         |  Gateway  |  | Forecast |  |  Sensors   |
         +-----------+  +----------+  +------------+
```

---

## 2. Adapter Specifications & Diagnostic Standards

### 2.1 SMS Notification Adapter
- **Purpose:** Emergency incident dispatch, PTW high-risk alerts, and user OTP verification.
- **Environment Variables:**
  - `SMS_PANEL_URL`: REST API endpoint of the SMS provider.
  - `SMS_PANEL_API_KEY`: Authentication Bearer token or API key.
- **Diagnostic States:**
  - `UNCONFIGURED`: Variables absent; system logs warning and skips external dispatch without raising errors.
  - `HEALTHY`: Endpoint responds with HTTP 200 within 2000 ms.
  - `DEGRADED`: Network timeout (> 2000 ms) or provider rate limit (HTTP 429) encountered.

### 2.2 Weather Service Adapter
- **Purpose:** Supplies ambient wind speed (m/s), temperature, and precipitation forecasts for:
  - Crane Lifting Plans (`wind_speed_limit_mps`, default 9.8 m/s).
  - Open Trench & Excavation safety assessments (rainfall water ingress).
  - Work at Height permits (high wind hazard).
- **Environment Variables:**
  - `WEATHER_API_URL`: Weather forecasting service endpoint.
  - `WEATHER_API_KEY`: API access token.
- **Fail-Safe Behavior:**
  - If weather service is unreachable, system falls back to conservative defaults (e.g., operator manual meteorological input).
  - Safety gates never allow blind bypass; if wind speed cannot be fetched, crane lifting plans require manual wind speed confirmation.

### 2.3 IoT Gas Detection & Environmental Telemetry Adapter
- **Purpose:** Real-time atmospheric sensor monitoring ($H_2S$, $CO$, $LEL$, $O_2$) for Confined Space entry.
- **Environment Variables:**
  - `IOT_MQTT_BROKER_HOST`: MQTT broker address.
  - `IOT_MQTT_BROKER_PORT`: MQTT port (1883 / 8883).
- **Diagnostic States:**
  - `DISCONNECTED`: Broker unreachable; entry permits require physical calibrated gas detector logs.
  - `CONNECTED`: Active MQTT keep-alive with telemetry heartbeat < 10 seconds.

---

## 3. Operator Diagnostic Test Script

Operators can execute the following verification script on staging or production to evaluate all configured adapters without creating live alerts:

```python
"""
Save as: backend/scripts/verify_integrations.py
Run via: python backend/manage.py shell < backend/scripts/verify_integrations.py
"""
import os
import time
import urllib.request
import urllib.error

print("=" * 60)
print("HSE Guard — External Integrations Health Diagnostic Probe")
print("=" * 60)

# 1. SMS Gateway Probe
sms_url = os.getenv("SMS_PANEL_URL", "").strip()
sms_key = os.getenv("SMS_PANEL_API_KEY", "").strip()
if not sms_url:
    print("[SMS ADAPTER]     : UNCONFIGURED (Optional - In-app notifications active)")
else:
    try:
        t0 = time.time()
        req = urllib.request.Request(sms_url, headers={"Authorization": f"Bearer {sms_key}"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            latency = round((time.time() - t0) * 1000, 1)
            print(f"[SMS ADAPTER]     : HEALTHY (Status {resp.status}, Latency: {latency} ms)")
    except urllib.error.HTTPError as e:
        print(f"[SMS ADAPTER]     : REACHABLE (HTTP {e.code})")
    except Exception as e:
        print(f"[SMS ADAPTER]     : DEGRADED ({str(e)})")

# 2. Weather Gateway Probe
weather_url = os.getenv("WEATHER_API_URL", "").strip()
if not weather_url:
    print("[WEATHER ADAPTER] : UNCONFIGURED (Manual operator meteorological entry required)")
else:
    try:
        t0 = time.time()
        req = urllib.request.Request(weather_url, headers={"User-Agent": "HSE-Guard-Probe/1.0"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            latency = round((time.time() - t0) * 1000, 1)
            print(f"[WEATHER ADAPTER] : HEALTHY (Status {resp.status}, Latency: {latency} ms)")
    except Exception as e:
        print(f"[WEATHER ADAPTER] : DEGRADED ({str(e)})")

# 3. IoT MQTT Broker Probe
mqtt_host = os.getenv("IOT_MQTT_BROKER_HOST", "localhost").strip()
mqtt_port = int(os.getenv("IOT_MQTT_BROKER_PORT", "1883"))
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(2.0)
try:
    s.connect((mqtt_host, mqtt_port))
    s.close()
    print(f"[IOT MQTT BROKER] : CONNECTED ({mqtt_host}:{mqtt_port})")
except Exception as e:
    print(f"[IOT MQTT BROKER] : UNREACHABLE ({mqtt_host}:{mqtt_port} - {str(e)})")

print("=" * 60)
print("Diagnostic probe completed.")
```

---

## 4. Staging Validation Acceptance Criteria

Before staging sign-off:
1. `UNCONFIGURED` status for optional external providers is acceptable and must not cause any 500 Internal Server Errors in UI workflows.
2. If credentials are provided, adapter must return `HEALTHY` or clean `REACHABLE` status.
3. Fallback behaviors (manual gas measurement entry, manual crane wind speed entry) must be completely operational.
