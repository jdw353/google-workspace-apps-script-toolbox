/*
  Google Chat Updates Bot
  github.com/jdw353

  TL;DR:
  Keep up to date with any feed by having new posts published to a Google Chat
  room using Apps Script and Webhooks. Feeds included in this example are
  various official Google blogs.

  How it works:
  - The script is deployed as a single Apps Script project and file.
  - initializeScript() is run first, which requests scope authorization, clears
  local storage, adds a timer trigger, and kicks off the primary workflow.
  - executeUpdateWorkflow() will then pull down records for each configured feed
  and determine whether or not it has been before by the script (using local
  storage). If it has been seen, it is skipped. If it's new, it is queued for
  posting. Local storage is updated accordingly.
  - New posts are then published to any subscribed Chat room using Webhooks.

  Script Configuration:
  Modify the below variables to match requirements. All are required, but most
  can be left as default.
  - WEBHOOKS: the destination for any published posts. You must provide a
  webhook URL in the YOUR_WEBHOOK_URL_GOES_HERE space
  - MAX_CONTENT.CHARS: the length of the article summary that is included in the
  Chat card
  - MAX_CONTENT.UPDATES: the number of new updates to send. Generally does not
  need to be updated
  - MAX_INIT_UPDATES: when initializing the script, how many initial posts to
  send to a room
  - TRIGGER_INTERVAL_HOURS: how often the script will check for updates
  - NOTIFY_HOURS.START: hour of the day after which notifications can be sent (local time)
  - NOTIFY_HOURS.END: hour of the day after which no notifications should be sent (local time)
  - NOTIFY_WEEKEND: whether the script should run on the weekend (local time)

  Script Extension
  This script was made to handle the various formats of the supported Google
  blogs. However, it can easily be extended to support other feed formats or
  webhook platforms. 
  - FEED_FORMAT: a type of feed input, requring a name and a
  parseFunction
  - WEBHOOK_PLATFORMS: a type of webook output, requring a name and
  a viewFunction
*/

const TRIGGER_INTERVAL_HOURS = 1;
const NOTIFY_WEEKEND = false;
const MAX_INIT_UPDATES = 1;
const MAX_CONTENT = {
  CHARS: 250,
  UPDATES: 10 // Cannot be greater than 25 for RSS.
};
const NOTIFY_HOURS = {
  START: 9,
  END: 17
};

const FEED_FORMAT = {
  FB_XML: {
    name: 'Feed Burner XML',
    parseFunction: parseFBXmlIntoUpdateObject_,
  },
  GOOGLE_BLOG_RSS: {
    name: 'Google Blog RSS',
    parseFunction: parseGoogleBlogRssIntoUpdateObject_,
  }
};

const WEBHOOK_PLATFORMS = {
  GOOGLE_CHAT: {
    name: 'Google Chat',
    viewFunction: buildGoogleChatView_,
  }
};

// Replace YOUR_WEBHOOK_URL_GOES_HERE with a webhook URL from Google Chat.
const WEBHOOKS = {
  ADMIN_ROOM: {
    name: 'Google Workspace Admin Room',
    type: WEBHOOK_PLATFORMS.GOOGLE_CHAT,
    url: 'YOUR_WEBHOOK_URL_GOES_HERE'
  },
};

const FEEDS = {
  WORKSPACE_UPDATES: {
    format: FEED_FORMAT.FB_XML,
    title: 'Google Workspace Updates',
    subtitle: 'workspaceupdates.googleblog.com',
    source: 'https://feeds.feedburner.com/GoogleAppsUpdates',
    logo: 'https://fonts.gstatic.com/s/i/productlogos/googleg/v6/web-512dp/logo_googleg_color_1x_web_512dp.png',
    cta: 'READ MORE',
    filters: ['What’s changing', 'Quick launch summary'],
    webhooks: [WEBHOOKS.ADMIN_ROOM]
  },
  CHROME_RELEASES: {
    format: FEED_FORMAT.FB_XML,
    title: 'Chrome Releases',
    subtitle: 'chromereleases.googleblog.com',
    source: 'https://feeds.feedburner.com/GoogleChromeReleases',
    logo: 'https://fonts.gstatic.com/s/i/productlogos/chrome/v6/web-512dp/logo_chrome_color_1x_web_512dp.png',
    cta: 'READ MORE',
    filters: ['Hi everyone!'],
    webhooks: [WEBHOOKS.ADMIN_ROOM]
  },
  GCP_TRAINING: {
    format: FEED_FORMAT.GOOGLE_BLOG_RSS,
    title: 'GCP Training & Certification',
    subtitle: 'cloudblog.withgoogle.com',
    source:
        'https://cloudblog.withgoogle.com/topics/training-certifications/rss/',
    logo:
        'https://fonts.gstatic.com/s/i/productlogos/google_cloud/v8/web-512dp/logo_google_cloud_color_1x_web_512dp.png',
    cta: 'READ MORE',
    filters: [],
    webhooks: [WEBHOOKS.ADMIN_ROOM]
  },
  DEVELOPERS: {
    format: FEED_FORMAT.FB_XML,
    title: 'Google Developers',
    subtitle: 'developers.googleblog.com',
    source: 'https://feeds.feedburner.com/GDBcode',
    logo:
        'https://fonts.gstatic.com/s/i/productlogos/google_developers/v7/web-512dp/logo_google_developers_color_1x_web_512dp.png',
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
  executeUpdateWorkflow(null, true);

  // Logs the storage for manual validation.
  logScriptProperties();
}

function executeUpdateWorkflow(trigger, initialization) {
  // Skip execution if we're not initializing or outside of notification hours.
  if (!(initialization || isValidExecutionWindow_())) {
    return;
  }

  Object.keys(FEEDS).forEach(function(feed) {
    try {
      let feedUpdates = fetchLatestUpdates_(feed);
      let newUpdates = checkForNewUpdates_(feed, feedUpdates);
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
  let feedUpdates = PropertiesService.getScriptProperties().getProperties();
  Object.keys(feedUpdates).forEach(function(id) {
    let updates = JSON.parse(feedUpdates[id]);
    Logger.log(`Feed: ${id}`);
    Logger.log(updates);
  });
}

/**
 * Workflow (Private) Functions
 */

function isValidExecutionWindow_() {
  let date = new Date();
  let validDay = (NOTIFY_WEEKEND || !(date.getDay() === 0 || date.getDay() === 6));
  let validHour = (date.getHours() >= NOTIFY_HOURS.START && date.getHours() < NOTIFY_HOURS.END);
  Logger.log(`${Session.getScriptTimeZone()}: valid day (${validDay}), valid hour (${validHour})`);
  return (validDay && validHour);
}

function fetchLatestUpdates_(feed) {
  let updates = [];

  let results =
      UrlFetchApp.fetch(FEEDS[feed].source, {muteHttpExceptions: true});

  if (results.getResponseCode() !== 200) {
    Logger.log(results.message);
    return updates;
  }

  updates = FEEDS[feed].format.parseFunction(feed, results.getContentText());

  // Cap the number of updates that are processed and stored.
  let recordsToRemove = updates.length - MAX_CONTENT.UPDATES;
  if (recordsToRemove > 0) {
    updates.splice(-recordsToRemove, recordsToRemove);
  }

  return updates;
}

function checkForNewUpdates_(feed, feedUpdates) {
  if (!feedUpdates) {
    return [];
  }

  let newUpdates = [];
  let latestUpdates = [];
  let properties = PropertiesService.getScriptProperties().getProperties();
  let existingUpdates = properties[feed] ? JSON.parse(properties[feed]) : [];

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

  Logger.log(`${feed}: ${newUpdates.length} new updates were found.`);
  return newUpdates;
}

function sendUpdatesToWebhooks_(feed, newUpdates) {
  FEEDS[feed].webhooks.forEach(function(webhook) {
    newUpdates.forEach(function(update) {
      let updateView = webhook.type.viewFunction(FEEDS[feed], update);
      postUpdate_(webhook.url, updateView);
    });
  });
}

function postUpdate_(url, updateView) {
  try {
    let options = {
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
  let updates = [];
  let document = XmlService.parse(feedXml);
  let atom = XmlService.getNamespace('http://www.w3.org/2005/Atom');
  let entries = document.getRootElement().getChildren('entry', atom);

  entries.forEach(function(entry) {
    let id = entry.getChild('id', atom).getText();
    let publishedDate = entry.getChild('published', atom).getText();
    let title = entry.getChild('title', atom).getText();
    let content = entry.getChild('content', atom).getText();
    let linkOptions = entry.getChildren('link', atom);
    let link = '';
    for (let i = 0; i < linkOptions.length; i++) {
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
  let updates = [];
  let document = XmlService.parse(feedXml);
  let entries =
      document.getRootElement().getChild('channel').getChildren('item');

  entries.forEach(function(entry) {
    let guid = entry.getChild('guid').getText();
    let publishedDate = entry.getChild('pubDate').getText();
    let title = entry.getChild('title').getText();
    let description = entry.getChild('description').getText();
    let link = entry.getChild('link').getText();
    updates.push(buildUpdateObject_(
        feed, guid, publishedDate, title, description, link));
  });

  return updates;
}

function buildUpdateObject_(feed, id, date, title, content, link) {
  // Remove some special characters and any filters that are specific to a feed.
  let finalContent = content.replace(/<[^>]+>/g, '');
  FEEDS[feed].filters.forEach(function(filter) {
    finalContent = finalContent.replace(filter, '');
  });

  return {
    feed: feed,
    id: id,
    date: new Date(date).toDateString(),
    title: title,
    content: finalContent.substring(0, MAX_CONTENT.CHARS).trim() + '...',
    link: link
  };
}

function clearProperties_() {
  PropertiesService.getScriptProperties().deleteAllProperties();
}

function resetTriggers_() {
  // First clear all the triggers.
  let triggers = ScriptApp.getProjectTriggers();
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
            {'textParagraph': {'text': `<b>${update.title}</b>`}},
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
