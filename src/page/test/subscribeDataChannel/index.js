/*
Copyright © 2015 Infrared5, Inc. All rights reserved.

The accompanying code comprising examples for use solely in conjunction with Red5 Pro (the "Example Code") 
is  licensed  to  you  by  Infrared5  Inc.  in  consideration  of  your  agreement  to  the  following  
license terms  and  conditions.  Access,  use,  modification,  or  redistribution  of  the  accompanying  
code  constitutes your acceptance of the following license terms and conditions.

Permission is hereby granted, free of charge, to you to use the Example Code and associated documentation 
files (collectively, the "Software") without restriction, including without limitation the rights to use, 
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit 
persons to whom the Software is furnished to do so, subject to the following conditions:

The Software shall be used solely in conjunction with Red5 Pro. Red5 Pro is licensed under a separate end 
user  license  agreement  (the  "EULA"),  which  must  be  executed  with  Infrared5,  Inc.   
An  example  of  the EULA can be found on our website at: https://account.red5pro.com/assets/LICENSE.txt.

The above copyright notice and this license shall be included in all copies or portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,  INCLUDING  BUT  
NOT  LIMITED  TO  THE  WARRANTIES  OF  MERCHANTABILITY, FITNESS  FOR  A  PARTICULAR  PURPOSE  AND  
NONINFRINGEMENT.   IN  NO  EVENT  SHALL INFRARED5, INC. BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN  AN  ACTION  OF  CONTRACT,  TORT  OR  OTHERWISE,  ARISING  FROM,  OUT  OF  OR  IN CONNECTION 
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function(window, document, red5prosdk) {
  'use strict';

  var serverSettings = (function() {
    var settings = sessionStorage.getItem('r5proServerSettings');
    try {
      return JSON.parse(settings);
    }
    catch (e) {
      console.error('Could not read server settings from sessionstorage: ' + e.message);
    }
    return {};
  })();

  var configuration = (function () {
    var conf = sessionStorage.getItem('r5proTestBed');
    try {
      return JSON.parse(conf);
    }
    catch (e) {
      console.error('Could not read testbed configuration from sessionstorage: ' + e.message);
    }
    return {}
  })();
  red5prosdk.setLogLevel(configuration.verboseLogging ? red5prosdk.LOG_LEVELS.TRACE : red5prosdk.LOG_LEVELS.WARN);

  var targetSubscriber;

  var updateStatusFromEvent = window.red5proHandleSubscriberEvent; // defined in src/template/partial/status-field-subscriber.hbs
  var instanceId = Math.floor(Math.random() * 0x10000).toString(16);
  var streamTitle = document.getElementById('stream-title');
  var statisticsField = document.getElementById('statistics-field');
  var bitrateField = document.getElementById('bitrate-field');
  var packetsField = document.getElementById('packets-field');
  var resolutionField = document.getElementById('resolution-field');

  var protocol = serverSettings.protocol;
  var isSecure = protocol === 'https';

  var bitrate = 0;
  var packetsReceived = 0;
  var frameWidth = 0;
  var frameHeight = 0;

  function updateStatistics (b, p, w, h) {
    statisticsField.classList.remove('hidden');
    bitrateField.innerText = b === 0 ? 'N/A' : Math.floor(b);
    packetsField.innerText = p;
    resolutionField.innerText = (w || 0) + 'x' + (h || 0);
  }

  function onBitrateUpdate (b, p) {
    bitrate = b;
    packetsReceived = p;
    updateStatistics(bitrate, packetsReceived, frameWidth, frameHeight);
  }

  function onResolutionUpdate (w, h) {
    frameWidth = w;
    frameHeight = h;
    updateStatistics(bitrate, packetsReceived, frameWidth, frameHeight);
  }

  // Determines the ports and protocols based on being served over TLS.
  function getSocketLocationFromProtocol () {
    return !isSecure
      ? {protocol: 'ws', port: serverSettings.wsport}
      : {protocol: 'wss', port: serverSettings.wssport};
  }

  // Base configuration to extend in providing specific tech failover configurations.
  var defaultConfiguration = (function(useVideo, useAudio) {
    var c = {
      protocol: getSocketLocationFromProtocol().protocol,
      port: getSocketLocationFromProtocol().port
    };
    if (!useVideo) {
      c.videoEncoding = red5prosdk.PlaybackVideoEncoder.NONE;
    }
    if (!useAudio) {
      c.audioEncoding = red5prosdk.PlaybackAudioEncoder.NONE;
    }
    return c;
  })(configuration.useVideo, configuration.useAudio);

  function showModal (content) {
    var div = document.createElement('div');
    div.classList.add('modal');
    var container = document.createElement('div');
    var button = document.createElement('a');
    var close = document.createTextNode('close');
    button.href = "#";
    button.appendChild(close);
    button.classList.add('modal-close');
    container.appendChild(button);
    container.appendChild(content);
    div.appendChild(container);
    document.body.appendChild(div);
    button.addEventListener('click', function (event) {
      event.preventDefault();
      document.body.removeChild(div);
      return false;
    });
  }

  function closePreviousModal () {
    var modal = document.querySelector('.modal')
    if (modal) {
      modal.parentNode.removeChild(modal)
    }
  }

  function createRPCMessageContent (json) {
    closePreviousModal()
    var style = 'padding: 10px'
    var content = document.createElement('div')
    var p = document.createElement('p')
    var header = document.createTextNode(rtcConfig.streamName + ' has sent an RPC Message:')
    p.appendChild(header)
    var messageP = document.createElement('p')
    messageP.style = style
    var timestampP = document.createElement('p')
    timestampP.style = style
    var invokeP = document.createElement('p')
    invokeP.style = style
    var invoke = document.createTextNode('invoke: ' + json.methodName)
    invokeP.appendChild(invoke)
    var message = document.createTextNode('message: ' + json.data.message)
    messageP.appendChild(message)
    var timestamp = document.createTextNode('timestamp: ' + new Date(json.data.timestamp))
    timestampP.appendChild(timestamp)
    content.appendChild(p)
    content.appendChild(invokeP)
    content.appendChild(messageP)
    content.appendChild(timestampP)
    return content
  }

  function createMessageContent (jsonString) {
    closePreviousModal()
    var json = JSON.parse(jsonString)
    var data = json.data || json
    var style = 'padding: 10px'
    var content = document.createElement('div')
    var p = document.createElement('p')
    var header = document.createTextNode(rtcConfig.streamName + ' has sent a non-RPC Message:')
    p.appendChild(header)
    var messageP = document.createElement('p')
    messageP.style = style
    var timestampP = document.createElement('p')
    timestampP.style = style
    var message = document.createTextNode('message: ' + data.message)
    messageP.appendChild(message)
    var timestamp = document.createTextNode('timestamp: ' + new Date(data.timestamp))
    timestampP.appendChild(timestamp)
    content.appendChild(p)
    content.appendChild(messageP)
    content.appendChild(timestampP)
    return content
  }

  function createAudioPlaybackContent (arrayBuffer) {
    closePreviousModal()
    var style = 'padding: 10px; text-align: center'
    var blob = new Blob([arrayBuffer])
    var audioURL = window.URL.createObjectURL(blob)
    var content = document.createElement('div')
    var p = document.createElement('p')
    var header = document.createTextNode(rtcConfig.streamName + ' has sent an Audio Message:')
    var holder = document.createElement('p')
    holder.style = style
    var audio = document.createElement('audio')
    audio.controls = true
    audio.src = audioURL
    audio.controlsList = "nodownload"
    holder.appendChild(audio)
    p.appendChild(header)
    content.appendChild(p)
    content.appendChild(holder)
    return content
  }

  // Local lifecycle notifications.
  function onSubscriberEvent (event) {
    if (event.type !== 'Subscribe.Time.Update') {
      console.log('[Red5ProSubscriber] ' + event.type + '.');
      updateStatusFromEvent(event);
      if (event.type === 'Subscribe.VideoDimensions.Change') {
        onResolutionUpdate(event.data.width, event.data.height);
      } else if (event.type === 'WebRTC.DataChannel.Message') {
        // Non-descript data coming in to handle.
        // event.data.message will be a MessageEvent directly from the DataChannel
        // event.data.message.data will be either a String or ArrayBuffer/Blob
        var data = event.data.message.data
        if (typeof data === 'string') {
          showModal(createMessageContent(data))
        } else {
          showModal(createAudioPlaybackContent(data))
        }
      } else if (event.type === 'Subscribe.Send.Invoke') {
        // Standard RPC call.
        showModal(createRPCMessageContent(event.data))
      }
    }
  }
  function onSubscribeFail (message) {
    console.error('[Red5ProSubsriber] Subscribe Error :: ' + message);
  }
  function onSubscribeSuccess (subscriber) {
    console.log('[Red5ProSubsriber] Subscribe Complete.');
    if (window.exposeSubscriberGlobally) {
      window.exposeSubscriberGlobally(subscriber);
    }
    if (subscriber.getType().toLowerCase() === 'rtc') {
      try {
        window.trackBitrate(subscriber.getPeerConnection(), onBitrateUpdate, onResolutionUpdate, true);
      }
      catch (e) {
        //
      }
    }
  }
  function onUnsubscribeFail (message) {
    console.error('[Red5ProSubsriber] Unsubscribe Error :: ' + message);
  }
  function onUnsubscribeSuccess () {
    console.log('[Red5ProSubsriber] Unsubscribe Complete.');
  }

  function getAuthenticationParams () {
    var auth = configuration.authentication;
    return auth && auth.enabled
      ? {
        connectionParams: {
          username: auth.username,
          password: auth.password,
          token: auth.token
        }
      }
      : {};
  }

  // Request to unsubscribe.
  function unsubscribe () {
    return new Promise(function(resolve, reject) {
      var subscriber = targetSubscriber
      subscriber.unsubscribe()
        .then(function () {
          targetSubscriber.off('*', onSubscriberEvent);
          targetSubscriber = undefined;
          onUnsubscribeSuccess();
          resolve();
        })
        .catch(function (error) {
          var jsonError = typeof error === 'string' ? error : JSON.stringify(error, null, 2);
          onUnsubscribeFail(jsonError);
          reject(error);
        });
    });
  }

  // Define tech spefific configurations for each failover item.
  var config = Object.assign({},
    configuration,
    defaultConfiguration,
    getAuthenticationParams(), {
      streamName: configuration.stream1
    });
  var rtcConfig = Object.assign({}, config, {
    protocol: getSocketLocationFromProtocol().protocol,
    port: getSocketLocationFromProtocol().port,
    subscriptionId: 'subscriber-' + instanceId
  })
  var rtmpConfig = Object.assign({}, config, {
    protocol: 'rtmp',
    port: serverSettings.rtmpport,
    width: config.cameraWidth,
    height: config.cameraHeight,
    backgroundColor: '#000000',
    swf: '../../lib/red5pro/red5pro-subscriber.swf',
    swfobjectURL: '../../lib/swfobject/swfobject.js',
    productInstallURL: '../../lib/swfobject/playerProductInstall.swf'
  })
  var hlsConfig = Object.assign({}, config, {
    protocol: protocol,
    port: isSecure ? serverSettings.hlssport : serverSettings.hlsport
  })

  // Define failover order.
  var subscribeOrder = config.subscriberFailoverOrder
        .split(',').map(function (item) {
          return item.trim();
        });

  // Override for providing ?view= query param.
  if (window.query('view')) {
    subscribeOrder = [window.query('view')];
  }

  // Request to initialization and start subscribing through failover support.
  var subscriber = new red5prosdk.Red5ProSubscriber()
  subscriber.setPlaybackOrder(subscribeOrder)
    .init({
      rtc: rtcConfig,
      rtmp: rtmpConfig,
      hls: hlsConfig
    })
    .then(function (subscriberImpl) {
      streamTitle.innerText = configuration.stream1;
      targetSubscriber = subscriberImpl
      // Subscribe to events.
      targetSubscriber.on('*', onSubscriberEvent);
      return targetSubscriber.subscribe()
    })
    .then(function () {
      onSubscribeSuccess(targetSubscriber);
    })
    .catch(function (error) {
      var jsonError = typeof error === 'string' ? error : JSON.stringify(error, null, 2);
      console.error('[Red5ProSubscriber] :: Error in subscribing - ' + jsonError);
      onSubscribeFail(jsonError);
    });

  // Clean up.
  var shuttingDown = false;
  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    function clearRefs () {
      if (targetSubscriber) {
        targetSubscriber.off('*', onSubscriberEvent);
      }
      targetSubscriber = undefined;
    }
    unsubscribe().then(clearRefs).catch(clearRefs);
    window.untrackBitrate();
  }
  window.addEventListener('pagehide', shutdown);
  window.addEventListener('beforeunload', shutdown);

})(this, document, window.red5prosdk);

