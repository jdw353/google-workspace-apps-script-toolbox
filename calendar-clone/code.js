// [SOURCE_CALENDAR_ID] and [DESTINATION_CALENDAR_ID]
// For a primary calendar, this will be something like user@gmail.com.
// For a secondary calendar, this will be something like xyz@group.calendar.google.com

const SOURCE = 'YOUR_EMAIL_ADDRESS_GOES_HERE';
const DESTINATION = 'SECONDARY_CALENDAR_ID@group.calendar.google.com';
const NUM_DAYS = 28;
const ERRORS = [
  "Service timed out: Calendar",
  "We're sorry, a server error occurred. Please wait a bit and try again.",
];

function main() {
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + (NUM_DAYS * 86400 * 1000));
  Logger.log(`Start: ${startDate.toDateString()} | End: ${endDate.toDateString()}`);

  clearDestinationEvents_({ startDate: startDate, endDate: endDate });
  cloneEvents_({ startDate: startDate, endDate: endDate });
}

function clearDestinationEvents_({ startDate, endDate } = {}) {
  const destinationEvents = CalendarApp.getCalendarById(DESTINATION).getEvents(startDate, endDate);

  (destinationEvents.length > 0) ? Logger.log(`Deleting events...`) : Logger.log(`No events to delete...`);

  destinationEvents.forEach(function (event) {
    Logger.log(`${event.getStartTime().toDateString()} | ${event.getTitle()}`);
    event.deleteEvent();
  });
}

function cloneEvents_({ startDate, endDate } = {}) {
  // TODO: Wrap this in a try/catch as well.
  const sourceEvents = CalendarApp.getCalendarById(SOURCE).getEvents(startDate, endDate);
  const destination = CalendarApp.getCalendarById(DESTINATION);

  (sourceEvents.length > 0) ? Logger.log(`Cloning events...`) : Logger.log(`No events to clone...`);

  sourceEvents.forEach((sourceEvent) => {
    const status = sourceEvent.getMyStatus();
    const title = sourceEvent.getTitle();
    const startTime = sourceEvent.getStartTime();
    const isAllDayEvent = sourceEvent.isAllDayEvent();
    const eventType = sourceEvent.getEventType();
    // Transparency is Calendar's free/busy indicator.
    const transparency = sourceEvent.getTransparency();

    const isAccepted = !status || status !== status.NO;
    const isNotWorkingLocation = !isEventWorkingLocation_({ title: title, isAllDayEvent: isAllDayEvent, eventType: eventType });
    try {
      if (isAccepted && isNotWorkingLocation) {
        const newEvent = destination.createEvent(
          title,
          startTime,
          sourceEvent.getEndTime(),
          {
            description: sourceEvent.getDescription(),
            location: sourceEvent.getLocation()
          }
        );
        newEvent.setTransparency(transparency);
        if (sourceEvent.getColor()) {
          newEvent.setColor(sourceEvent.getColor());
        }
        Logger.log(`CLONED: ${startTime.toDateString()} | ${title} | ${eventType}`);
      } else {
        Logger.log(`SKIPPED: ${startTime.toDateString()} | ${title} | ${eventType}`);
      }
    } catch (e) {
      Logger.log(`Error caught: ${e.name} | ${e.message}`);
      // Known errors can be skipped. A delay may be enough to allow the rest to complete.
      // If there's an unknown (to the script) error, we want it to be thrown so we can see it.
      if (ERRORS.includes(e.message)) {
        Logger.log(`Failed event: ${title}`);
        Utilities.sleep(10000); // 10 seconds
      } else {
        throw e;
      }
    }

  });
}

// Dash count is purely based on Google office naming conventions
// TODO: This can likely be fully removed in exchange for the eventType check.
function isEventWorkingLocation_({ title, isAllDayEvent, eventType } = {}) {
  const dashMatch = title.match(/-/g);
  const dashCount = dashMatch ? dashMatch.length : 0;
  const isHome = title.trim() == "Home";
  const hasOffice = title.includes("(Office)");
  const isWorkingLocation = eventType == "WORKING_LOCATION";

  return isWorkingLocation || (isAllDayEvent && (isHome || (dashCount == 2 && hasOffice)));
}
