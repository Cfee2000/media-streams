const EventEmitter = require('events');
const { Transform, PassThrough, pipeline } = require('stream');
const uuid = require('uuid');
//const dialogflow = require("dialogflow").v2beta1;
const { SessionsClient } = require('@google-cloud/dialogflow-cx');
const structjson = require('structjson');
const WaveFile = require('wavefile').WaveFile;
const util = require('util');
const pump = util.promisify(pipeline);

const intentQueryAudioFirstRequest = {
  languageCode: process.env.DIALOGFLOW_CX_LANGUAGE_CODE,
  audio: {
    config: {
      audioEncoding: 'AUDIO_ENCODING_MULAW',
      //audioEncoding: 'AUDIO_ENCODING_LINEAR_16',
      sampleRateHertz: 8000,
      //sampleRateHertz: 16000,
      //languageCode: 'en-US',
      singleUtterance: true,
    },
  },
};

function createDetectStream(isFirst, sessionId, sessionPath, sessionClient) {
  console.log('in createDetectStream');
  let queryInput = intentQueryAudioFirstRequest;
  // if (isFirst) {
  //   console.log('in isFirst = True');
  //   queryInput = intentQueryAudioFirstRequest;
  // } else {
  //   console.log('not isFirst = False');
  // }
  const initialStreamRequest = {
    queryInput,
    session: sessionPath,
    queryParams: {
      session: sessionPath,
    },
    outputAudioConfig: {
      audioEncoding: 'OUTPUT_AUDIO_ENCODING_LINEAR_16',
      //audioEncoding: 'OUTPUT_AUDIO_ENCODING_MULAW',
    },
  };

  const detectStream = sessionClient.streamingDetectIntent();
  detectStream.write(initialStreamRequest);
  return detectStream;
}

function createAudioResponseStream() {
  console.log('in createAudioResponseStream');
  return new Transform({
    objectMode: true,
    transform: (chunk, encoding, callback) => {
      if (
        !chunk.detectIntentResponse ||
        chunk.detectIntentResponse.outputAudio.length == 0
      ) {
        return callback();
      }
      // Convert the LINEAR 16 Wavefile to 8000/mulaw
      //console.log('At WaveFile Logic......................');
      const wav = new WaveFile();
      wav.fromBuffer(chunk.detectIntentResponse.outputAudio);
      wav.toSampleRate(8000);
      wav.toMuLaw();
      return callback(null, Buffer.from(wav.data.samples));
      // return callback(
      //   null,
      //   Buffer.from(chunk.detectIntentResponse.outputAudio).toString()
      // );
    },
  });
}

function createAudioRequestStream() {
  console.log('in createAudioRequestStream');
  return new Transform({
    objectMode: true,
    transform: (chunk, encoding, callback) => {
      //console.log(chunk);
      const msg = JSON.parse(chunk.toString('utf8'));
      // Only process media messages
      if (msg.event !== 'media') return callback();
      // This is mulaw/8000 base64-encoded
      return callback(null, {
        queryInput: { audio: { audio: msg.media.payload } },
      });
      //return callback(null, { inputAudio: msg.media.payload });
    },
  });
}

class DialogflowCXService extends EventEmitter {
  constructor() {
    super();
    this.sessionId = uuid.v4();
    // Instantiates a session client
    //this.sessionClient = new dialogflow.SessionsClient();
    this.sessionClient = new SessionsClient({
      apiEndpoint: `${process.env.DIALOGFLOW_CX_LOCATION}-dialogflow.googleapis.com`,
    });
    console.log('Project ID: ' + process.env.DIALOGFLOW_CX_PROJECT_ID);
    console.log('Location: ' + process.env.DIALOGFLOW_CX_LOCATION);
    console.log('Agent ID: ' + process.env.DIALOGFLOW_CX_AGENT_ID);
    console.log('Session ID: ' + this.sessionId);
    this.sessionPath = this.sessionClient.projectLocationAgentSessionPath(
      process.env.DIALOGFLOW_CX_PROJECT_ID,
      process.env.DIALOGFLOW_CX_LOCATION,
      process.env.DIALOGFLOW_CX_AGENT_ID,
      this.sessionId
    );
    console.log(this.sessionPath);
    // State management
    this.isFirst = true;
    this.isReady = false;
    this.isStopped = false;
    this.isInterrupted = false;
  }

  send(message) {
    //console.log('in send message');
    const stream = this.startPipeline();
    stream.write(message);
  }

  getFinalQueryResult() {
    console.log('in getFinalQueryResult');
    if (this.finalQueryResult) {
      const queryResult = {
        intent: {
          name: this.finalQueryResult.intent.name,
          displayName: this.finalQueryResult.intent.displayName,
        },
        parameters: structjson.structProtoToJson(
          this.finalQueryResult.parameters
        ),
      };
      return queryResult;
    }
  }

  startPipeline() {
    //console.log('in startPipeline');
    //console.log(this.isReady);
    if (!this.isReady) {
      //console.log(this.isReady);
      // Generate the streams
      this._requestStream = new PassThrough({ objectMode: true });
      this.audioStream = createAudioRequestStream();
      this.detectStream = createDetectStream(
        this.isFirst,
        this.sessionId,
        this.sessionPath,
        this.sessionClient
      );
      this.responseStream = new PassThrough({ objectMode: true });
      this.audioResponseStream = createAudioResponseStream();
      if (this.isFirst) this.isFirst = false;
      this.isInterrupted = false;
      // Pipeline is async....
      // await pump(
      //   this._requestStream,
      //   audioStream,
      //   detectStream,
      //   responseStream,
      //   audioResponseStream
      // )
      //   .then((success) => {
      //     this.isReady = false;
      //     console.log('IM NOW FALSE!!!!!!!');
      //     console.log(success);
      //   })
      //   .catch((err) => {
      //     console.log(err);
      //   });

      pipeline(
        this._requestStream,
        this.audioStream,
        this.detectStream,
        this.responseStream,
        this.audioResponseStream,
        (err) => {
          if (err) {
            this.emit('error', err);
          } else {
            // Update the state so as to create a new pipeline
            this.isReady = false;
            console.log('IM NOW FALSE!!!!!!!');
          }
        }
      );

      this._requestStream.on('data', (data) => {
        if (!this.audioStream.write(data)) {
          this._requestStream.pause();
          this.audioStream.once('drain', () => {
            this._requestStream.resume();
          });
        }
        //console.log('requestStream - data');
        const msg = JSON.parse(data.toString('utf8'));
        //console.log(msg);
        if (msg.event === 'start') {
          console.log(`Captured call ${msg.start.callSid}`);
          this.emit('callStarted', {
            callSid: msg.start.callSid,
            streamSid: msg.start.streamSid,
          });
        }
        if (msg.event === 'mark') {
          console.log(`Mark received ${msg.mark.name}`);
          if (msg.mark.name === 'endOfInteraction') {
            this.emit('endOfInteraction', this.getFinalQueryResult());
          }
        }
      });

      this.responseStream.on('data', (data) => {
        console.log('responseStream - data');
        console.log(data);
        if (
          data.recognitionResult &&
          data.recognitionResult.transcript &&
          data.recognitionResult.transcript.length > 0
        ) {
          this.emit('interrupted', data.recognitionResult.transcript);
        }
        if (
          data.queryResult &&
          data.queryResult.intent &&
          data.queryResult.intent.endInteraction
        ) {
          console.log(
            `Ending interaction with: ${data.queryResult.fulfillmentText}`
          );
          this.finalQueryResult = data.queryResult;
          this.stop();
        }
        if (data.detectIntentResponse != null) {
          //console.log(data);
          console.log('Detected Intent:');
          const result = data.detectIntentResponse.queryResult;

          console.log(`User Query: ${result.transcript}`);
          for (const message of result.responseMessages) {
            if (message.text) {
              console.log(`Agent Response: ${message.text.text}`);
            }
          }
          if (result.match.intent) {
            console.log(`Matched Intent: ${result.match.intent.displayName}`);
          }
          console.log(`Current Page: ${result.currentPage.displayName}`);
          //console.log('we have a response!!!!!!!!!!!!!!!!');
          //responseStream.end();
          //audioResponseStream.end();
          //this.isReady = false;
        }
      });
      this.audioResponseStream.on('data', (data) => {
        console.log('audioResponseStream - data');
        console.log(data);
        this.emit('audio', data.toString('base64'));
        //this.sessionClient.streamingDetectIntent().end();
        //this.isReady = false;
        //this._requestStream.
        //responseStream.end();
        // console.log(
        //   'Detect Stream !!!!!!!!!!! ' + JSON.stringify(this.detectStream)
        // );
      });

      this.detectStream.on('drain', () => {
        //this.audioStream.resume();
        //this.isReady = false;
      });

      this.audioStream.on('data', (data) => {
        //console.log('audioStream - data');
        //console.log(data);
      });

      //THis is the same as the responseStream,just passthrough
      this.detectStream.on('data', (data) => {
        //console.log('detectStream - data');
        //console.log(data);
      });

      this._requestStream.on('error', (err) => {
        console.log(err);
      });
      this.responseStream.on('error', (err) => {
        console.log(err);
      });
      this.audioResponseStream.on('error', (err) => {
        console.log(err);
      });
      this.audioStream.on('error', (err) => {
        console.log(err);
      });
      this.detectStream.on('error', (err) => {
        console.log(err);
      });

      this._requestStream.on('end', () => {
        console.log('request stream end;;;;;;;;;;;;;;;;;;');
      });
      this.responseStream.on('end', () => {
        console.log('response stream end;;;;;;;;;;;;;;;;;;');
      });
      this.audioResponseStream.on('end', () => {
        console.log('audio response stream end;;;;;;;;;;;;;;;;;;');
      });
      this.audioStream.on('end', () => {
        console.log('audio stream end;;;;;;;;;;;;;;;;;;');
      });
      this.detectStream.on('end', () => {
        console.log('detect stream end;;;;;;;;;;;;;;;;;;');
      });

      this._requestStream.on('finish', () => {
        console.log('request stream finish;;;;;;;;;;;;;;;;;;');
      });
      this.responseStream.on('finish', () => {
        console.log('response stream finish;;;;;;;;;;;;;;;;;;');
      });
      this.audioResponseStream.on('finish', () => {
        console.log('audio response stream finish;;;;;;;;;;;;;;;;;;');
      });
      this.audioStream.on('finish', () => {
        console.log('audio stream finish;;;;;;;;;;;;;;;;;;');
      });
      this.detectStream.on('finish', () => {
        console.log('detect stream finish;;;;;;;;;;;;;;;;;;');
      });

      // Set ready
      this.isReady = true;
    }
    return this._requestStream;
  }

  stop() {
    console.log('Stopping Dialogflow');
    this.isStopped = true;
  }

  finish() {
    console.log('Disconnecting from Dialogflow');
    this._requestStream.end();
  }
}

module.exports = {
  DialogflowCXService,
};
