// Query max is 500. Batch max is 100.
const THREADS_PER_QUERY = 100;  // Max 500
const DELETE_EMPTY_CHILD = true;

// This is the nice name of the label, not the query name.
// For example, if your label is 'Parent Label', use
// 'Parent Label' not 'label:parent-label'.
const LABEL_TO_FLATTEN = 'My Label';

function processLabels() {
  const pLabel = GmailApp.getUserLabelByName(LABEL_TO_FLATTEN);
  Logger.log(`Flattening to parent label: ${pLabel.getName()}`);

  const children = GmailApp.getUserLabels().filter(
      label => label.getName().includes(LABEL_TO_FLATTEN + '/'));
  Logger.log(`Child labels identified: ${children.length}`);

  children.forEach(function(cLabel) {
    const labelName = cLabel.getName();
    Logger.log(`Processing label: ${labelName}`);

    let threadsProcessed = 0;
    do {
      let threads = cLabel.getThreads(0, THREADS_PER_QUERY);
      Logger.log(`Threads identified: ${threads.length}`);

      if (threads.length === 0) {
        Logger.log(`Finished processing label: ${labelName}`);
        Logger.log(`Total threads processed: ${threadsProcessed}`);
        break;
      }

      // Prioritize batch for results <= 100.
      if (threads.length > 100) {
        processSerial_(pLabel, cLabel, threads);
      } else {
        processBatch_(pLabel, cLabel, threads);
      }

      threadsProcessed += threads.length;
    } while (true);

    if (DELETE_EMPTY_CHILD) {
      cLabel.deleteLabel();
      Logger.log(`${labelName} deleted.`)
    }
  });
}

function processBatch_(pLabel, cLabel, threads) {
  pLabel.addToThreads(threads);
  cLabel.removeFromThreads(threads);
  Logger.log(`Batch flattened.`);
}

function processSerial_(plabel, cLabel, threads) {
  for (let i = 0; i < threads.length; i++) {
    threads[i].addLabel(plabel);
    threads[i].removeLabel(cLabel);
    if ((i + 1) % 20 === 0 || (i + 1) === threads.length) {
      Logger.log(`Flattened ${i + 1} of ${threads.length} threads.`);
    }
  }
}