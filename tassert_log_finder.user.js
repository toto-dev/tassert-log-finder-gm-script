// ==UserScript==
// @name        Find tassert logs
// @namespace   Violentmonkey Scripts
// @match       https://buildbaron.corp.mongodb.com/ui/*
// @grant       none
// @version     1.0
// @author      -
// @homepageURL https://github.com/toto-dev/tassert-log-finder-gm-script
// @updateUrl   https://github.com/toto-dev/tassert-log-finder-gm-script/raw/main/tassert_log_finder.user.js
// @dowloadURL  https://github.com/toto-dev/tassert-log-finder-gm-script/raw/main/tassert_log_finder.user.js
// @description 5/13/2024, 9:14:08 PM
// @grant GM_xmlhttpRequest
// @grant GM_setClipboard
// ==/UserScript==

/*
 * Convenience function to execute your callback only after an element matching
 * readySelector has been added to the page. Example:
 * runWhenReady('.search-result', augmentSearchResults); Gives up after 1
 * minute.
 */
function runWhenReady(readySelector, callback) {
  var numAttempts = 0;
  var tryNow = function() {
    var elem = document.querySelector(readySelector);
    if (elem) {
      callback(elem);
    } else {
      numAttempts++;
      if (numAttempts >= 34) {
        console.warn('Giving up after 34 attempts. Could not find: ' +
                     readySelector);
      } else {
        setTimeout(tryNow, 250 * Math.pow(1.1, numAttempts));
      }
    }
  };
  tryNow();
}

const buttonsRawSelector = "div.row:nth-child(3)";
const consoleIdSelector = "console-output";

function log(txt, replaceLast = false) {
  console.log(`XOXO | ${txt}`);
  let consoleDiv = document.getElementById(consoleIdSelector);

  let newPara = document.createElement('p')
  newPara.innerHTML = txt;

  if (replaceLast) {
    consoleDiv.removeChild(consoleDiv.lastChild);
  }

  consoleDiv.appendChild(newPara);
}

function processLogs(logs) {
  log('Completed log download');
  try {
    let tripwireLog = logs.response.match(/^.*Tripwire assertion.*$/m)[0]
    log(`Found log: ${tripwireLog}`);
    let rawJsonLog = tripwireLog.match(/{.*}/)[0];
    let jsonLog = JSON.parse(rawJsonLog);

    let prettyLog = `${JSON.stringify(jsonLog.msg)}\n${
        JSON.stringify(jsonLog.attr.error, null, 2)}`;

    // Display the log in text area in pretty format
    let resDiv = document.createElement('textArea');
    resDiv.setAttribute('rows', 10);
    resDiv.innerHTML = prettyLog;
    document.getElementById(consoleIdSelector).appendChild(resDiv);

    // Copy the log to the clipboard
    GM_setClipboard(prettyLog);
    log("Log copied to clipboard");
  } catch (error) {
    log(`Encoutered error while processing logs: ${error}`);
  }
}

function processBfgInfo(bfgInfo) {
  let selectedTest = bfgInfo.failing_tests.find((test) => {
    if (test.raw_log_url.includes('build/TestLogs/job0')) {
      return true;
    }
    return false;
  });

  if (!selectedTest) {
    let error = `Couldn't find teardown test among the failed tests: ${
        JSON.stringify(bfgInfo.failing_tests)}`;
    log(`ERROR: ${error}`);
    throw Error(error);
  }

  let rawLogUrl =
      selectedTest.raw_log_url.match(/https:\/\/.*TestLogs\/job0/)[0];
  log(`Choosen test: ${JSON.stringify(selectedTest)}`);
  log(`Raw log url: ${rawLogUrl}`);
  log('');

  return GM_xmlhttpRequest({
    url : rawLogUrl,
    mehtod : 'GET',
    responseType : 'text',
    onload : function(response) { processLogs(response); },
    onprogress : function(progress) {
      log(`Download progress -> [loaded: ${progress.loaded}, total: ${
              progress.total}]`,
          /* replaceLast = */ true)
    },
    onerror : function(error) { log(`Error fetching logs: ${error}`); }
  });
}

function getBfgInfo(bfgId) {
  log("Fetching BFG infos");
  const bfgMetadaUrl = "https://buildbaron.corp.mongodb.com/api/bfgs/" + bfgId;
  return GM_xmlhttpRequest({
    url : bfgMetadaUrl,
    mehtod : 'GET',
    responseType : 'json',
    onload : function(response) { processBfgInfo(response.response); },
    onerror : function(error) { console.error('Error fetching JSON:', error); }
  });
}

function addConsoleDiv() {
  let consoleDiv = document.createElement('div');
  consoleDiv.setAttribute('class', 'row');
  consoleDiv.innerHTML = `
    <div class="bp3-card bp3-elevation-3 full-width">
      <h3 class="bp3-heading padded-heading">Console</h3>
      <div id="console-output" class="buildbaron-noformat">
      </div>
    </div>
  `;
  let buttonsRaw = document.querySelector(buttonsRawSelector);
  buttonsRaw.parentNode.insertBefore(consoleDiv, buttonsRaw.nextSibling);
}

function ButtonClickAction(zEvent) {
  addConsoleDiv();
  getBfgInfo(document.title);
}

function addButtons() {
  let buttonsRaw = document.querySelector(buttonsRawSelector);
  let divider = document.createElement('div');
  divider.setAttribute('class', 'bp3-divider')

  let zNode = document.createElement('div');

  zNode.setAttribute('class',
                     'bp3-form-group bp3-inline action-panel-no-border');
  zNode.innerHTML = `
    <div class="bp3-form-content action-panel-container">
      <span aria-haspopup="true" class="bp3-popover2-target">
          <a id="totoButton" role="button" class="bp3-button bp3-intent-primary" tabindex="0">
            <span class="bp3-button-text">Find tassert log</span>
        </a>
      </span>
    </div>
  `;
  buttonsRaw.appendChild(zNode);

  //--- Activate the newly added button.
  document.getElementById("totoButton")
      .addEventListener("click", ButtonClickAction, false);
}

function main() {
  console.log("XOXO | Started custom script");
  addButtons();
}

runWhenReady(buttonsRawSelector, main);
