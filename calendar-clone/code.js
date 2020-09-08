// [SOURCE_CALENDAR_ID] and [DESTINATION_CALENDAR_ID]
// For a primary calendar, this will be something like user@gmail.com.
// For a secondary calendar, this will be something like xyz@group.calendar.google.com
var SOURCE = '[SOURCE_CALENDAR_ID]';
var DESTINATION = '[DESTINATION_CALENDAR_ID]';
var NUM_DAYS = 14;

function main() { 
  var day = new Date();
  for (var i = 0; i < NUM_DAYS; i++) {
    clearDestinationEvents_(day);
    cloneEvents_(day);
    day.setDate(day.getDate() + 1);
  }
}

function clearDestinationEvents_(date) {
  var destinationEvents = CalendarApp.getCalendarById(DESTINATION).getEventsForDay(date);
  
  destinationEvents.forEach(function(event) {
    event.deleteEvent();
  });
}

function cloneEvents_(date) {
  var sourceEvents = CalendarApp.getCalendarById(SOURCE).getEventsForDay(date);
  var destination = CalendarApp.getCalendarById(DESTINATION);

  for (var i = 0; i < sourceEvents.length; i++) {
    var status = sourceEvents[i].getMyStatus();
    if (status !== status.NO) {
      var event = destination.createEvent(
        sourceEvents[i].getTitle(),
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
    }
  }
}