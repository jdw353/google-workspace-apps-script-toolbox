# G Suite Updates Bot

## Create a webhook in Hangouts Chat
1. In a Hangouts Chat room, select 'Configure webhooks'.
2. If one already exists, select 'Add another', otherwise...
3. Enter a name for your webhook. You may want to use 'G Suite Updates'.
4. Enter an icon for your webhook. You may want to use [this image](https://lh3.googleusercontent.com/proxy/Avi9GdfQQrgH3Iyy7f92yR4NElOpiq46VzMwnCWAFJRvj_GU_r2f2aUdKDNiQfchDKg50O2jj445ohIY_TuGoGyDGWVZVcedIMAwuM7eKX88ymDx40A=s88-c).
5. Save the webhook.
6. Once saved, copy the webhook URL, which you'll need when you setup the script.

## Implement this script
1. Create a new Apps Script project.
2. Copy and paste the code from code.js (in this repo) into Code.gs (in the Apps script project).
3. Update the configuration directly in the code. At minimum, replace [YOUR_WEBHOOK_URL_GOES_HERE] with your webhook's URL.
4. Run initializeScript() and authorize scopes.
5. Run logScriptProperties() to verify local storage is working properly.
6. Check your Hangouts Chat room for your first update.

## End result
![Example post from the bot](/examplepost.png)