---
id: productivity
name: Productivity
description: Calculator, date/time, and weather
icon: Zap
isBuiltin: true
tools:
  - name: calculator
    description: Evaluate a mathematical expression and return the numeric result.
    executor: builtin
    parameters:
      type: object
      properties:
        expression:
          type: string
          description: A math expression using +, -, *, /, (, ), ., %, and numbers.
      required:
        - expression
  - name: get_datetime
    description: Get the current date and time, optionally formatted for a specific timezone.
    executor: builtin
    parameters:
      type: object
      properties:
        timezone:
          type: string
          description: 'IANA timezone name, e.g. "America/New_York". Defaults to UTC.'
      required: []
  - name: weather_lookup
    description: Get the current weather for a location.
    executor: builtin
    parameters:
      type: object
      properties:
        location:
          type: string
          description: 'City name or location, e.g. "London" or "New York, NY"'
      required:
        - location
---

# Productivity Skill

Utility tools for everyday tasks: math, time, and weather.

## `calculator`
- Use for arithmetic expressions: `3 * (12 + 7) / 2`, `15%`, `2^8`.
- Only handles numeric math — not symbolic algebra.
- For complex logic or code evaluation, prefer `js_eval` (Code Execution skill).

## `get_datetime`
- Call with no arguments for UTC time.
- Pass a valid IANA timezone string for local time, e.g. `"Asia/Shanghai"`, `"Europe/London"`.
- Always present the datetime in a friendly, readable format to the user.

## `weather_lookup`
- Pass a city name or city+country/state for best results.
- Returns temperature (°C and °F), humidity, wind speed, and conditions.
- Data is from wttr.in; accuracy may vary for small or uncommon locations.
