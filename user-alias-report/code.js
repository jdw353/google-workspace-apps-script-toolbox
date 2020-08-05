/*
  G Suite User Alias Report
  
  Configuration:
  - YOUR_PRIMARY_DOMAIN_HERE: Replace with your G Suite primary domain.
  - YOUR_SHEET_ID_HERE: Replace with the ID of a Google Sheet.

*/

var USER_OPTIONS = {
    domain: 'YOUR_PRIMARY_DOMAIN_HERE',
    customer: 'my_customer',
    maxResults: 500,
    projection: 'basic',
    viewType: 'domain_public',
    orderBy: 'email'
  };
  
  var OUTPUT_SHEET_ID = 'YOUR_SHEET_ID_HERE';
  
  function main() {
    var users = fetchDomainUsers_();
    writeHeaderToSheet_();
    for (var i = 0; i < users.length; i++) {
      writeUserToSheet_(users[i]);
    }
  }
  
  function fetchDomainUsers_() {
    var users = [];
    var pageCount = 1;
    do {
      var response = AdminDirectory.Users.list(USER_OPTIONS);
      response.users.forEach(function(user) {
        users.push({'name': user.name.fullName, 'emails': user.emails});
      });
  
      // For domains with many users, the results are paged.
      if (response.nextPageToken) {
        USER_OPTIONS.pageToken = response.nextPageToken;
      }
      
      Logger.log('Page ' + pageCount + ': ' + response.users.length + ' users.');
      pageCount++;
    } while (response.nextPageToken);
    return users;
  }
  
  function writeHeaderToSheet_() {
    var sheet = SpreadsheetApp.openById(OUTPUT_SHEET_ID).getSheets()[0];
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, 3).setValues([['User Name', 'Email Address', 'Is Primary?']]);
  }
  
  function writeUserToSheet_(user) {
    var records = [];
    if (user.emails.length > 0) {
      for (var i = 0; i < user.emails.length; i++) {
        records.push([user.name, user.emails[i].address, (user.emails[i].primary === true)]);
      }  
    }
    
    var sheet = SpreadsheetApp.openById(OUTPUT_SHEET_ID).getSheets()[0];
    sheet.getRange(sheet.getLastRow() + 1, 1, records.length, 3).setValues(records);
  }