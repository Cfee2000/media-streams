require('dotenv').config();
const express = require('express');
const hbs = require('express-handlebars');
const expressWebSocket = require('express-ws');
const websocket = require('websocket-stream');
const websocketStream = require('websocket-stream/stream');
const Twilio = require('twilio');
const { DialogflowCXService } = require('./dialogflow-cx-utils');

const PORT = process.env.PORT || 8080;

const app = express();
// extend express app with app.ws()
expressWebSocket(app, null, {
  perMessageDeflate: false,
});

app.engine('hbs', hbs());
app.set('view engine', 'hbs');

// make all the files in 'public' available
app.use(express.static('public'));
app.get('/', (request, response) => {
  response.render('home', { layout: false });
});

// Responds with Twilio instructions to begin the stream
app.post('/twiml', (request, response) => {
  console.log('in twiml endpoint');
  response.setHeader('Content-Type', 'application/xml');
  // ngrok sets x-original-host header
  const host = request.headers['x-original-host'] || request.hostname;
  response.render('twiml', { host, layout: false });
});

app.ws('/media', (ws, req) => {
  console.log('in /media endpoint');
  let client;
  try {
    client = new Twilio();
  } catch (err) {
    if (process.env.TWILIO_ACCOUNT_SID === undefined) {
      console.error(
        'Ensure that you have set your environment variable TWILIO_ACCOUNT_SID. This can be copied from https://twilio.com/console'
      );
      console.log('Exiting');
      return;
    }
    console.log('in first try: ' + err.message);
  }
  // This will get populated on callStarted
  let callSid;
  let streamSid;
  // MediaStream coming from Twilio
  console.log('before mediastream');
  const mediaStream = websocketStream(ws, {
    binary: false,
  });

  console.log('before dialogflowCXService');
  try {
    const dialogflowCXService = new DialogflowCXService();

    console.log('after dialogflowCXService');
    mediaStream.on('data', (data) => {
      //console.log('mediaStream - data');
      //console.log(JSON.parse(data)); //Get the Verbose media stream logging
      dialogflowCXService.send(data);
    });

    mediaStream.on('finish', () => {
      console.log('MediaStream has finished');
      dialogflowCXService.finish();
    });

    dialogflowCXService.on('callStarted', (data) => {
      console.log('callstarted event');
      callSid = data.callSid;
      streamSid = data.streamSid;
    });

    dialogflowCXService.on('audio', (audio) => {
      console.log(' audio event');
      //dialogflowCXService._requestStream.pause();
      const mediaMessage = {
        streamSid,
        event: 'media',
        media: {
          payload: audio,
        },
      };
      const mediaJSON = JSON.stringify(mediaMessage);
      console.log(`Sending audio (${audio.length} characters)`);
      mediaStream.write(mediaJSON);

      //dialogflowCXService._requestStream.end();
      //dialogflowCXService.audioStream.end();
      //dialogflowCXService.detectStream.end();
      //dialogflowCXService.responseStream.end();
      //dialogflowCXService.audioResponseStream.end();
      //dialogflowCXService._requestStream.destroy();
      //dialogflowCXService.audioStream.destroy();
      //dialogflowCXService.detectStream
      //dialogflowCXService.responseStream.destroy();
      //dialogflowCXService.audioResponseStream.destroy();

      if (dialogflowCXService.audioStream.isPaused()) {
        //console.log(dialogflowCXService.audioStream);
        console.log('audio stream is paused $$$$$$$$$$$$$$$');
      }
      if (dialogflowCXService.responseStream.isPaused()) {
        console.log('response stream is paused $$$$$$$$$$$$$$$');
      }
      if (dialogflowCXService._requestStream.isPaused()) {
        console.log('requestStream is paused $$$$$$$$$$$$$$$');
      }
      if (dialogflowCXService.detectStream.isPaused()) {
        console.log('detectStream is paused $$$$$$$$$$$$$$$');
      }
      if (dialogflowCXService.audioResponseStream.isPaused()) {
        console.log('audioResponseStream is paused $$$$$$$$$$$$$$$');
      }
      //dialogflowCXService._requestStream.end();
      //dialogflowCXService.responseStream.destroy();
      //dialogflowCXService.audioResponseStream.end();
      //dialogflowCXService.isReady = false;

      // If this is the last message
      if (dialogflowCXService.isStopped) {
        console.log('in Mark Message - STOP cuz its the last message');
        const markMessage = {
          streamSid,
          event: 'mark',
          mark: {
            name: 'endOfInteraction',
          },
        };
        const markJSON = JSON.stringify(markMessage);
        console.log('Sending end of interaction mark', markJSON);
        mediaStream.write(markJSON);
      }
    });

    dialogflowCXService.on('interrupted', (transcript) => {
      console.log(`Interrupted with "${transcript}"`);
      if (!dialogflowCXService.isInterrupted) {
        console.log('Clearing...');
        const clearMessage = {
          event: 'clear',
          streamSid,
        };
        mediaStream.write(JSON.stringify(clearMessage));
        dialogflowCXService.isInterrupted = true;
      }
    });

    dialogflowCXService.on('endOfInteraction', (queryResult) => {
      console.log('endOfInteraction event');
      const response = new Twilio.twiml.VoiceResponse();
      const url = process.env.END_OF_INTERACTION_URL;
      if (url) {
        const qs = JSON.stringify(queryResult);
        // In case the URL has a ?, use an ampersand
        const appendage = url.includes('?') ? '&' : '?';
        response.redirect(
          `${url}${appendage}dialogflowJSON=${encodeURIComponent(qs)}`
        );
      } else {
        response.hangup();
      }
      const twiml = response.toString();
      return client
        .calls(callSid)
        .update({ twiml })
        .then((call) =>
          console.log(`Updated Call(${callSid}) with twiml: ${twiml}`)
        )
        .catch((err) => console.error(err));
    });
  } catch (err) {
    console.log(err);
  }
});

const listener = app.listen(PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
