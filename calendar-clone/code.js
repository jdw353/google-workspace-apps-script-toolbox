// [SOURCE_CALENDAR_ID] and [DESTINATION_CALENDAR_ID]
// For a primary calendar, this will be something like user@gmail.com.
// For a secondary calendar, this will be something like xyz@group.calendar.google.com

const SOURCE = 'YOUR_EMAIL_ADDRESS_GOES_HERE';
const DESTINATION = 'SECONDARY_CALENDAR_ID@group.calendar.google.com';
const NUM_DAYS = 14;

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
  const sourceEvents = CalendarApp.getCalendarById(SOURCE).getEvents(startDate, endDate);
  const destination = CalendarApp.getCalendarById(DESTINATION);

  (sourceEvents.length > 0) ? Logger.log(`Cloning events...`) : Logger.log(`No events to clone...`);

  sourceEvents.forEach((sourceEvent) => {
    const status = sourceEvent.getMyStatus();
    const title = sourceEvent.getTitle();
    const startTime = sourceEvent.getStartTime();
    const isAllDayEvent = sourceEvent.isAllDayEvent();

    const isAccepted = !status || status !== status.NO;
    const isNotWorkingLocation = !isEventWorkingLocation_({ title: title, isAllDayEvent: isAllDayEvent });

    if (isAccepted && isNotWorkingLocation) {
      Logger.log(`CLONED: ${startTime.toDateString()} | ${title}`);
      let newEvent = destination.createEvent(
        title,
        startTime,
        sourceEvent.getEndTime(),
        {
          description: sourceEvent.getDescription(),
          location: sourceEvent.getLocation()
        }
      );
      if (sourceEvent.getColor()) {
        newEvent.setColor(sourceEvent.getColor());
      }
    } else {
      Logger.log(`SKIPPED: ${startTime.toDateString()} | ${title}`);
    }
  });
}

// Dash count is purely based on Google office naming conventions
function isEventWorkingLocation_({ title, isAllDayEvent } = {}) {
  const dashMatch = title.match(/-/g);
  const dashCount = dashMatch ? dashMatch.length : 0;
  const isHome = title.trim() == "Home";
  const hasOffice = title.includes("(Office)");

  return (isAllDayEvent && (isHome || (dashCount == 2 && hasOffice)));
}
