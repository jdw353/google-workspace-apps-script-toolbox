const SOURCE = 'YOUR_EMAIL_ADDRESS';
const STATUS = `INVITED`;
const NUM_DAYS = 21;
const DECLINE_HOURS = {
  AFTER: 20,
  BEFORE: 7
};
const BLOCK_LIST = [
  "CALENDAR_EVENT_NAMES_GO_HERE",
  "CALENDAR_EVENT_NAMES_GO_HERE_1",
];

function main() {
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + (NUM_DAYS * 86400 * 1000));
  Logger.log(`Start: ${startDate.toDateString()} | End: ${endDate.toDateString()}`);

  const events = getEventsToDecline_({ startDate: startDate, endDate: endDate });
  if (events.length > 0) deleteEvents_({ events });
}

function getEventsToDecline_({ startDate, endDate }) {
  const sourceEvents = CalendarApp.getCalendarById(SOURCE).getEvents(startDate, endDate);
  const rejectEvents = sourceEvents.filter((event) => isRejected_({ event: event }));
  Logger.log(`Events to delete: ${rejectEvents.length}`)
  rejectEvents.forEach((event) => logEvent_({ event: event }));
  return rejectEvents;
}

function isRejected_({ event } = {}) {
  const status = event.getMyStatus();
  const title = event.getTitle();
  const startTime = event.getStartTime();
  const rejection = determineRejection_({ status: status, title: title, startTime: startTime });
  Logger.log(`${startTime.toDateString()} | ${title} | ${status} | ${rejection}`);
  return rejection;
}

function determineRejection_({ status, title, startTime } = {}) {
  const startFail = startTime.getHours() >= DECLINE_HOURS.AFTER || startTime.getHours() < DECLINE_HOURS.BEFORE;
  const statusFail = status == STATUS;
  const titleFail = BLOCK_LIST.includes(title);
  return statusFail && (startFail || titleFail);
}

function deleteEvents_({ events } = {}) {
  Logger.log(`Deleting events...`)
  events.forEach((event) => {
    Logger.log(`${event.getTitle()} deleted`);
    event.deleteEvent();
  });
}

function logEvent_({ event } = {}) {
  Logger.log(`Event: ${event.getTitle()}`);
  Logger.log(`Status: ${event.getMyStatus()}`);
  Logger.log(`Start: ${event.getStartTime()}`);
}
