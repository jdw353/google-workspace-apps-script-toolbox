const SOURCE = 'YOUR_EMAIL_ADDRESS';
const LOG_ID = `YOUR_GOOGLE_DOC_ID`;
const STATUS = CalendarApp.GuestStatus.INVITED;
const NUM_DAYS = 21;
const DECLINE_HOURS = {
  AFTER: 20,
  BEFORE: 7
};
const ALLOW_USERS = [
  "LDAP@EMAIL.COM",
  "LDAP2@EMAIL.COM"
];
const REJECT_TITLES = [
  "CALENDAR_EVENT_NAMES_GO_HERE_1",
  "CALENDAR_EVENT_NAMES_GO_HERE_2",
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
  return rejectEvents;
}

function isRejected_({ event } = {}) {
  const creator = event.getCreators()[0];
  const status = event.getMyStatus();
  const title = event.getTitle();
  const startTime = event.getStartTime();
  const rejection = determineRejection_({ status: status, title: title, startTime: startTime, creator: creator });
  Logger.log(`${startTime.toDateString()} | ${title} | ${creator} | ${status} | ${rejection}`);
  return rejection;
}

function determineRejection_({ status, title, startTime, creator } = {}) {
  const startFail = startTime.getHours() >= DECLINE_HOURS.AFTER || startTime.getHours() < DECLINE_HOURS.BEFORE;
  const statusFail = status == STATUS;
  const titleFail = REJECT_TITLES.includes(title);
  const creatorFail = !ALLOW_USERS.includes(creator);
  return creatorFail && statusFail && (startFail || titleFail);
}

function deleteEvents_({ events } = {}) {
  const body = getLogBody_();

  Logger.log(`Deleting events...`)
  events.forEach((event) => {
    const logString = `DELETED: ${event.getStartTime().toDateString()} | ${event.getTitle()} | ${event.getCreators()[0]}`;
    Logger.log(logString);
    if (body) body.insertParagraph(0, logString);
    event.deleteEvent();
  });

  if (body) {
    const now = new Date();
    body.insertParagraph(0, now.toString());
  }
}

function getLogBody_({ } = {}) {
  try {
    return DocumentApp.openById(LOG_ID).getBody();
  } catch (e) {
    Logger.log(e);
    return null;
  }
}

function logEvent_({ event } = {}) {
  Logger.log(`Event: ${event.getTitle()}`);
  Logger.log(`Status: ${event.getMyStatus()}`);
  Logger.log(`Start: ${event.getStartTime()}`);
  Logger.log(`Creators: ${event.getCreators()}`);
}
