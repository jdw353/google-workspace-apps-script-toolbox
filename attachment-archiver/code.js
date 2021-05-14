/*
  Attachment Archiver

  Automatically intercept emails to the active user's inbox and, based on rules,
  route message attachments to a specified Google Drive folder. Once messages 
  are processed, they are marked as read and archived.

  Script links up with a Google Sheet to interpret and process rules, which can
  be added without updating the script. Template Sheet can be found at:
  https://docs.google.com/spreadsheets/d/15KfB7d7zxDaJvptfWlDezPh7CUzMgPgT8pFfy7gkL0w

  Triggers include:
    - POSTFIX: Looking for a specific keyword appended with + to the end of an email address.
    - SENDER: Looking for a specific message sender.
    - SUBJECT: Looking for a specific keyword in the message subject.
  
  Drive storage actions include:
    - NONE: Store the files directly in the destination folder.
    - DATE: Store the files in a subdirectory of the destination by date.
    - SENDER: Store the files in a subdirectory of the destination by sender.
  
  Drive domain view permissions include:
    - FALSE: do not share individual files with the domain, only inherited permissions will gain access.
    - TRUE: apply domain wide view permissions to each file.
*/

/*
  Script Configuration

  Modify the below variables to match requirements. All are required.
  MAX_EMAILS: the size of the Gmail search
  TRIGGER_MINUTES: how often the script runs and checks for new messages
  RULES_SHEET_ID = the ID of the Google Sheet with configured Rules
  RULES_SHEET_NAME = the name of the workbook tab on the Sheet that contains the Rules
*/
const MAX_EMAILS = 20;
const TRIGGER_MINUTES = 15;
const RULES_SHEET_ID = '1ZRgf5IpMTY3CI_bDC-2zAWiV3j82vvOI6ghJD8OXeyo';
const RULES_SHEET_NAME = 'Rules';

/*
  Public Functions
*/
function initialize() {
  resetTriggers_();
  processRules();
}

function processRules() {
  let rules = getRules_();
  rules.forEach(function(rule) {
    let query = buildQueryForTrigger_(rule);
    Logger.log(`${rule.description}: ${query}`);
    if (query) {
      let gmailThreads = GmailApp.search(query, 0, MAX_EMAILS);
      if (gmailThreads.length > 0) {
        Logger.log(`${rule.description}: ${gmailThreads.length} thread(s) were found`);
        gmailThreads.forEach(function(thread) {
          processNewThread_(thread, rule);
        });
      } else {
        Logger.log(`${rule.description}: no matching threads found`);
      }
    } else {
      Logger.log(`${rule.description}: ${rule.triggerType} is not a known trigger type`);
    }
  });
}

/*
  Private Functions
*/

function buildQueryForTrigger_(rule) {
  let query = 'has:attachment label:unread label:inbox ';
  let activeUserComponents = getActiveUser_().split('@');
  switch(rule.triggerType) {
    case 'POSTFIX':
      query += `to:(${activeUserComponents[0]}+${rule.triggerKeyword}@${activeUserComponents[1]})`;
      break;
    case 'SENDER':
      query += `from:(${rule.triggerKeyword})`;
      break;
    case 'SUBJECT':
      query += `subject:("${rule.triggerKeyword}")`;
      break;
    default:
      query = null;
  }
  return query;
}
 
function processNewThread_(thread, rule) {
  let attachments = thread.getMessages()[0].getAttachments();
  let driveId = determineDestinationDriveId_(rule, thread);
  attachments.forEach(function(attachment) {
    writeBlobToDrive_(attachment.copyBlob(), attachment.getName(), driveId, rule.domainView);
  });
  thread.markRead();
  thread.moveToArchive();
}

function determineDestinationDriveId_(rule, thread) {
  let driveId;
  switch(rule.subdirectory) {
     case 'SENDER':
       driveId = findOrCreateDirectory_(rule.destinationId, thread.getMessages()[0].getFrom());
       break;
     case 'DATE':
       driveId = findOrCreateDirectory_(rule.destinationId, getCurrentDate_());
       break;
     default:
       driveId = rule.destinationId;
   }
  return driveId;
}

function findOrCreateDirectory_(parentId, folderName) {
  let childId;
  let folders = DriveApp.getFolderById(parentId).getFoldersByName(folderName);
  while (folders.hasNext()) {
    childId = folders.next().getId();
    break;
  }
  if (!childId) {
    childId = DriveApp.getFolderById(parentId).createFolder(folderName).getId();
  }
  return childId;
}

function getRules_() {
  let sheet = getSheet_();
  let ruleList = sheet.getRange(2, 1, sheet.getLastRow(), 6).getValues();
  let rulesObjects = [];
  ruleList.forEach(function(rule) {
    if (rule[0]) {
      rulesObjects.push(getRuleObject_(rule));
    }
  });
  return rulesObjects;
}

function writeBlobToDrive_(blob, name, drive_id, domainView) {
 let file = DriveApp.createFile(blob);
 file.setName(name);
 if (domainView === true){
   file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
 }
 file.getParents().next().removeFile(file);
 DriveApp.getFolderById(drive_id).addFile(file);
 Logger.log(`${name} written to Drive folder ${drive_id}`);
}

function getRuleObject_(rule) {
  return {
    description: rule[0],
    destinationId: rule[1],
    triggerType: rule[2],
    triggerKeyword: rule[3],
    subdirectory: rule[4],
    domainView: rule[5]
  };
}

function getSheet_() {
  return SpreadsheetApp.openById(RULES_SHEET_ID).getSheetByName(RULES_SHEET_NAME);
}

function getCurrentDate_() {
  return Utilities.formatDate(new Date(), 'EST', 'yyyy-MM-dd');
}

function getActiveUser_() {
  return Session.getActiveUser().toString();
}

function resetTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger('processRules')
      .timeBased()
      .everyMinutes(TRIGGER_MINUTES)
      .create();
}