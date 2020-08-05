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
    Logger.log(users);
    for (var i = 0; i < users.length; i++) {
      writeUserToSheet(users[i]);
    }
  }
  
  function fetchDomainUsers_() {
    var users = [];
    do {
      var response = AdminDirectory.Users.list(USER_OPTIONS);
      response.users.forEach(function(user) {
        users.push({'name': user.name.fullName, 'emails': user.emails});
      });
  
      // For domains with many users, the results are paged.
      if (response.nextPageToken) {
        USER_OPTIONS.pageToken = response.nextPageToken;
      }
    } while (response.nextPageToken);
    return users;
  }
  
  function writeUserToSheet(user) {
    var records = [];
    if (user.emails.length > 0) {
      for (var i = 0; i < user.emails.length; i++) {
        records.push([user.name, user.emails[i].address, (user.emails[i].primary === true)]);
      }  
    }
    
    var sheet = SpreadsheetApp.openById(OUTPUT_SHEET_ID).getSheets()[0];
    sheet.getRange(sheet.getLastRow() + 1, 1, records.length, 3).setValues(records);
  }