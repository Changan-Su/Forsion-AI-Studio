---
id: calendar
name: Forsion Calendar
description: Access your Forsion Calendar data — view events, create new ones, and manage your schedule through AI.
icon: Calendar
required_apps:
  - calendar
tools:
  - name: get_events
    description: Retrieve calendar events for a date range
    parameters:
      type: object
      properties:
        start_date:
          type: string
          description: Start date in YYYY-MM-DD format
        end_date:
          type: string
          description: End date in YYYY-MM-DD format (defaults to start_date if omitted)
      required:
        - start_date
    executor:
      type: http
      url: "{{API_BASE_URL}}/data-hub/calendar?data_type=event&start={{start_date}}&end={{end_date}}"
      method: GET
  - name: create_event
    description: Create a new calendar event
    parameters:
      type: object
      properties:
        title:
          type: string
          description: Event title
        start_time:
          type: string
          description: Event start time in ISO 8601 format
        end_time:
          type: string
          description: Event end time in ISO 8601 format
        description:
          type: string
          description: Optional event description
      required:
        - title
        - start_time
    executor:
      type: http
      url: "{{API_BASE_URL}}/data-hub/calendar/events"
      method: POST
      bodyTemplate: '{"record_id": "evt_{{start_time}}", "payload": {"title": "{{title}}", "start_time": "{{start_time}}", "end_time": "{{end_time}}", "description": "{{description}}"}}'
  - name: update_event
    description: Update an existing calendar event
    parameters:
      type: object
      properties:
        event_id:
          type: string
          description: The ID of the event to update
        title:
          type: string
          description: Updated event title
        start_time:
          type: string
          description: Updated start time
        end_time:
          type: string
          description: Updated end time
        description:
          type: string
          description: Updated description
      required:
        - event_id
    executor:
      type: http
      url: "{{API_BASE_URL}}/data-hub/calendar/events"
      method: POST
      bodyTemplate: '{"record_id": "{{event_id}}", "payload": {"title": "{{title}}", "start_time": "{{start_time}}", "end_time": "{{end_time}}", "description": "{{description}}"}}'
---

# Forsion Calendar Skill

You have access to the user's Forsion Calendar. Use these tools to help them manage their schedule.

## When to use
- User asks about their schedule, meetings, or events
- User wants to create or modify calendar events
- User asks "what do I have tomorrow/this week"

## Behavior
- Always check the user's calendar before answering schedule questions
- When creating events, confirm the details with the user first
- Use the user's timezone (infer from context or ask)
- Format dates and times in a human-friendly way

## Authorization
This skill requires cross-app data authorization. If the user hasn't granted access to Calendar, the tool call will return a 403 error. Guide the user to grant access in Settings > Data Authorization.
