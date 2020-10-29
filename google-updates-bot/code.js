/*
  Google Workspace Updates Bot

  TL;DR:
  Keep up to date with all Google Workspace feature releases and updates by having
  updates from workspaceupdates.googleblog.com published to a Google Chat room.

  Specifics:
  - Deploy as one Apps Script project and file.
  - Polls the RSS feed for Google Workspace Updates and parses the XML.
  - Evaluates whether or not the update has been seen. If it has, it's skipped.
    If it's new, it is queued for posting.
  - State is saved for next run.
  - New posts are published to configured Chat rooms.

  Configuration:
  - You must provide a webhook URL in the YOUR_WEBHOOK_URL_GOES_HERE space.
  - You may modify MAX_CONTENT_CHARS, MAX_INIT_UPDATES.
  - There's no real good reason for updating MAX_CONTENT_UPDATES.
  - FeedFormat and WebhookPlatform can be expanded on to include other types.
*/

var TRIGGER_INTERVAL_HOURS = 1;
var MAX_CONTENT_CHARS = 250;

// Cannot be greater than 25 for RSS.
var MAX_CONTENT_UPDATES = 10;

// Should not be greater than MAX_CONTENT_UPDATES.
var MAX_INIT_UPDATES = 1;

var FeedFormat = {
  FB_XML: {
    name: 'Feed Burner XML',
    parseFunction: parseFBXmlIntoUpdateObject_,
  },
  GOOGLE_BLOG_RSS: {
    name: 'Google Blog RSS',
    parseFunction: parseGoogleBlogRssIntoUpdateObject_,
  }
};

var WebhookPlatform = {
  GOOGLE_CHAT: {name: 'Google Chat', view: buildGoogleChatView_}
};

// Replace YOUR_WEBHOOK_URL_GOES_HERE with a webhook URL from Google Chat.
var WEBHOOKS = {
  ADMIN_ROOM: {
    name: 'Google Workspace Admin Room',
    type: WebhookPlatform.GOOGLE_CHAT,
    url: 'YOUR_WEBHOOK_URL_GOES_HERE'
  }
};

var FEEDS = {
  GSU: {
    format: FeedFormat.FB_XML,
    title: 'Google Workspace Updates',
    subtitle: 'workspaceupdates.googleblog.com',
    source: 'http://feeds.feedburner.com/GoogleAppsUpdates',
    logo: 'http://www.stickpng.com/assets/images/5847f9cbcef1014c0b5e48c8.png',
    cta: 'READ MORE',
    filters: ['What’s changing', 'Quick launch summary'],
    webhooks: [WEBHOOKS.ADMIN_ROOM]
  },
  CRB: {
    format: FeedFormat.FB_XML,
    title: 'Chrome Releases',
    subtitle: 'chromereleases.googleblog.com',
    source: 'http://feeds.feedburner.com/GoogleChromeReleases',
    logo: 'https://storage.googleapis.com/kimberlybucket001/chrome.png',
    cta: 'READ MORE',
    filters: [],
    webhooks: [WEBHOOKS.ADMIN_ROOM]
  },
  TCB: {
    format: FeedFormat.GOOGLE_BLOG_RSS,
    title: 'GCP Training & Certification',
    subtitle: 'cloudblog.withgoogle.com',
    source: 'https://cloudblog.withgoogle.com/topics/training-certifications/rss/',
    logo: 'https://cdn.iconscout.com/icon/free/png-256/google-cloud-2038785-1721675.png',
    cta: 'READ MORE',
    filters: [],
    webhooks: [WEBHOOKS.ADMIN_ROOM]
  }
};

/**
 * Public Functions
 */

function initializeScript() {
  // Ensures the script is in a default state.
  clearProperties_();

  // Clears and initiates a single daily trigger.
  resetTriggers_();

  // Kicks off first fetch of feed updates. Set a flag to true that is only
  // modified here to alert that this is the first time the function is running.
  executeUpdateWorkflow(true);

  // Logs the storage for manual validation.
  logScriptProperties();
}

function executeUpdateWorkflow(initialization) {
  Object.keys(FEEDS).forEach(function(feed) {
    try {
      var feedUpdates = fetchLatestUpdates_(feed);
      var newUpdates = checkForNewUpdates_(feed, feedUpdates);
      if (newUpdates) {
        // The initialization flag is only set when this function is called from
        // initializeScript(). In order to not spam a webook, the results get
        // trimmed to the MAX_INIT_UPDATES amount if the number of updates is
        // larger.
        if (initialization && (newUpdates.length > MAX_INIT_UPDATES)) {
          newUpdates.length = MAX_INIT_UPDATES;
        }
        sendUpdatesToWebhooks_(feed, newUpdates);
      }
    } catch (err) {
      Logger.log(err);
    }
  });
}

function logScriptProperties() {
  var feedUpdates = PropertiesService.getScriptProperties().getProperties();
  Object.keys(feedUpdates).forEach(function(id) {
    var updates = JSON.parse(feedUpdates[id]);
    Logger.log('Feed: %s', id);
    Logger.log(updates);
  });
}

/**
 * Workflow (Private) Functions
 */

function fetchLatestUpdates_(feed) {
  var updates = [];

  var results =
      UrlFetchApp.fetch(FEEDS[feed].source, {muteHttpExceptions: true});

  if (results.getResponseCode() !== 200) {
    Logger.log(results.message);
    return updates;
  }

  updates = FEEDS[feed].format.parseFunction(feed, results.getContentText());

  // Cap the number of updates that are processed and stored.
  var recordsToRemove = updates.length - MAX_CONTENT_UPDATES;
  updates.splice(-recordsToRemove, recordsToRemove);

  return updates;
}

function checkForNewUpdates_(feed, feedUpdates) {
  if (!feedUpdates) {
    return [];
  }

  var newUpdates = [];
  var latestUpdates = [];
  var properties = PropertiesService.getScriptProperties().getProperties();
  var existingUpdates = properties[feed] ? JSON.parse(properties[feed]) : [];

  // For each update, determine if we've seen it before based on the ID's
  // existence in the script's storage. If we haven't seen it yet, store
  // it separately for use later in broadcasting.
  feedUpdates.forEach(function(update) {
    latestUpdates.push(update.id);
    if (existingUpdates.indexOf(update.id) === -1) {
      newUpdates.push(update);
    }
  });

  // Write the latest updates to storage, including any new ones.
  properties[feed] = JSON.stringify(latestUpdates);
  PropertiesService.getScriptProperties().setProperties(properties, true);

  return newUpdates;
}

function sendUpdatesToWebhooks_(feed, newUpdates) {
  FEEDS[feed].webhooks.forEach(function(webhook) {
    newUpdates.forEach(function(update) {
      var updateView = webhook.type.view(FEEDS[feed], update);
      postUpdate_(webhook.url, updateView);
    });
  });
}

function postUpdate_(url, updateView) {
  try {
    var options = {
      'contentType': 'application/json; charset=UTF-8',
      'method': 'post',
      'payload': JSON.stringify(updateView),
      'followRedirects': true,
      'muteHttpExceptions': true
    };
    return UrlFetchApp.fetch(url, options);
  } catch (err) {
    Logger.log(err);
  }
}

function parseFBXmlIntoUpdateObject_(feed, feedXml) {
  var updates = [];
  var document = XmlService.parse(feedXml);
  var atom = XmlService.getNamespace('http://www.w3.org/2005/Atom');
  var entries = document.getRootElement().getChildren('entry', atom);

  entries.forEach(function(entry) {
    var id = entry.getChild('id', atom).getText();
    var publishedDate = entry.getChild('published', atom).getText();
    var title = entry.getChild('title', atom).getText();
    var content = entry.getChild('content', atom).getText();
    var linkOptions = entry.getChildren('link', atom);
    var link = '';
    for (var i = 0; i < linkOptions.length; i++) {
      if (linkOptions[i].getAttribute('rel').getValue() === 'alternate') {
        link = linkOptions[i].getAttribute('href').getValue();
        break;
      }
    }
    updates.push(
        buildUpdateObject_(feed, id, publishedDate, title, content, link));
  });

  return updates;
}

function parseGoogleBlogRssIntoUpdateObject_(feed, feedXml) {
  var updates = [];
  var document = XmlService.parse(feedXml);
  var entries = document.getRootElement().getChild('channel').getChildren('item');

  entries.forEach(function(entry) {
    var guid = entry.getChild('guid').getText();
    var publishedDate = entry.getChild('pubDate').getText();
    var title = entry.getChild('title').getText();
    var description = entry.getChild('description').getText();
    var link = entry.getChild('link').getText();
    updates.push(
        buildUpdateObject_(feed, guid, publishedDate, title, description, link));
  });

  return updates;
}

function buildUpdateObject_(feed, id, date, title, content, link) {
  // Remove some special characters and any filters that are specific to a feed.
  var finalContent = content.replace(/<[^>]+>/g, '');
  FEEDS[feed].filters.forEach(function(filter) {
    finalContent = finalContent.replace(filter, '');
  });

  return {
    feed: feed,
    id: id,
    date: new Date(date).toDateString(),
    title: title,
    content: finalContent.substring(0, MAX_CONTENT_CHARS).trim() + '...',
    link: link
  };
}

function clearProperties_() {
  PropertiesService.getScriptProperties().deleteAllProperties();
}

function resetTriggers_() {
  // First clear all the triggers.
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  // Then initialize a single daily trigger.
  ScriptApp.newTrigger('executeUpdateWorkflow')
      .timeBased()
      .everyHours(TRIGGER_INTERVAL_HOURS)
      .create();
}

function buildGoogleChatView_(feed, update) {
  return {
    'cards': [{
      'header': {
        'title': feed.title,
        'subtitle': feed.subtitle,
        'imageUrl': feed.logo,
      },
      'sections': [
        {
          'widgets': [
            {'textParagraph': {'text': '<b>' + update.title + '</b>'}},
            {'textParagraph': {'text': update.content}}
          ]
        },
        {
          'widgets': [{
            'buttons': [{
              'textButton': {
                'text': feed.cta,
                'onClick': {'openLink': {'url': update.link}}
              }
            }]
          }]
        }
      ]
    }]
  };
}
