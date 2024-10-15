// [SOURCE_CALENDAR_ID] and [DESTINATION_CALENDAR_ID]
// For a primary calendar, this will be something like user@gmail.com.
// For a secondary calendar, this will be something like xyz@group.calendar.google.com

const SOURCE = 'YOUR_EMAIL_ADDRESS_GOES_HERE';
const DESTINATION = 'SECONDARY_CALENDAR_ID@group.calendar.google.com';
const NUM_DAYS = 14;

function main() { 
  const day = new Date();
  for (let i = 0; i < NUM_DAYS; i++) {
    clearDestinationEvents_(day);
    cloneEvents_(day);
    day.setDate(day.getDate() + 1);
  }
}

function clearDestinationEvents_(date) {
  const destinationEvents = CalendarApp.getCalendarById(DESTINATION).getEventsForDay(date);
  
  Logger.log(`Clearing events for ${date}`)
  destinationEvents.forEach(function(event) {
    event.deleteEvent();
  });
}

function cloneEvents_(date) {
  const sourceEvents = CalendarApp.getCalendarById(SOURCE).getEventsForDay(date);
  const destination = CalendarApp.getCalendarById(DESTINATION);

  for (let i = 0; i < sourceEvents.length; i++) {
    Logger.log(`Cloning events for ${date}`)

    const status = sourceEvents[i].getMyStatus();
    const title = sourceEvents[i].getTitle();
    const isAllDayEvent = sourceEvents[i].isAllDayEvent();

    if ((!status || status !== status.NO) && !isEventWorkingLocation_(title, isAllDayEvent)) {
      Logger.log(`${title} cloned`);
      let event = destination.createEvent(
        title,
        sourceEvents[i].getStartTime(),
        sourceEvents[i].getEndTime(),
        {
          description: sourceEvents[i].getDescription(),
          location: sourceEvents[i].getLocation()
        }
      )
      if (sourceEvents[i].getColor()) {
        event.setColor(sourceEvents[i].getColor());  
      }
    } else {
      Logger.log(`${title} skipped`);
    }
  }
}

// Dash count is purely based on Google office naming conventions
function isEventWorkingLocation_(eventTitle, isAllDayEvent) {
  const dashMatch = eventTitle.match(/-/g);
  const dashCount = dashMatch ? dashMatch.length : 0;
  const isHome = eventTitle.trim() == "Home";
  const hasOffice = eventTitle.includes("(Office)");
  
  return (isAllDayEvent && (isHome || (dashCount == 2 && hasOffice)));
}
