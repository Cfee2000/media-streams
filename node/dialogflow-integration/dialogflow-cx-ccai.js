const EventEmitter = require('events');
const { Transform, PassThrough, pipeline } = require('stream');
const uuid = require('uuid');
const structjson = require('structjson');
const WaveFile = require('wavefile').WaveFile;
const { ConversationsClient, ParticipantsClient, v2beta1 } =
  require('@google-cloud/dialogflow').v2beta1;

let conversationID = '';
let participantID = '';
let participantConfig = '';
let welcomeIntentResponse = '';

const replyAudioConfig = {
  audioEncoding: 'OUTPUT_AUDIO_ENCODING_LINEAR_16',
  sampleRateHertz: 16000,
};

//STEP 1: Create a new instance of a ConversationsClient and ParticipantsClient and provide the apiEndpoint
const conversationsClient = new ConversationsClient({
  apiEndpoint: process.env.DIALOGFLOW_CX_API_ENDPOINT,
});
const participantsClient = new ParticipantsClient({
  apiEndpoint: process.env.DIALOGFLOW_CX_API_ENDPOINT,
});

//Now that the call is in-progress, spin up the DialogFlow CX Conversation
//PRE-REQUISITE: A one-time setup for a DialogflowCX ConversationProfile will need to be created (see cx-conversationProfileSetup.js)

//STEP 2: Create a function that will encapsulate the logic required to create the DialogFlow CX agent interaction once the Twilio call is connected
async function createDialogFlowConversation() {
  //STEP 3: Contstruct the ConversationRequest object that will be passed to the createConversation() function
  //https://cloud.google.com/dialogflow/priv/docs/reference/rpc/google.cloud.dialogflow.v2beta1#google.cloud.dialogflow.v2beta1.CreateConversationRequest
  const conversationsRequest = {
    parent: `projects/${process.env.DIALOGFLOW_CX_PROJECT_ID}/locations/${process.env.DIALOGFLOW_CX_LOCATION}`,
    conversation: {
      conversationProfile: `projects/${process.env.DIALOGFLOW_CX_PROJECT_ID}/locations/${process.env.DIALOGFLOW_CX_LOCATION}/conversationProfiles/${process.env.DIALOGFLOW_CX_CONVERSATION_PROFILE_ID}`,
    },
  };
  try {
    //STEP 4: Use the createConversation method on your instance of ConversationsClient and pass the ConversationRequest object we created in Step 3. This will return a Conversation object with a ConversationID that can be used to create a Participant object representing the caller
    const [conversation] = await conversationsClient.createConversation(
      conversationsRequest
    );
    console.log(conversation); //Log the conversation JSON

    const convoParentPath = conversation.name;
    console.log('convoParentPath: ' + convoParentPath);
    conversationID = convoParentPath.substring(
      convoParentPath.lastIndexOf('/') + 1
    );
    console.log('conversationID: ' + conversationID);

    //STEP 5: Contstruct the ParticipantRequest object that will be passed to the createParticipant() method
    //https://cloud.google.com/dialogflow/priv/docs/reference/rpc/google.cloud.dialogflow.v2beta1#createparticipantrequest
    const participantRequest = {
      parent: `projects/${process.env.DIALOGFLOW_CX_PROJECT_ID}/locations/${process.env.DIALOGFLOW_CX_LOCATION}/conversations/${conversationID}`,
      participant: {
        role: 'END_USER',
      },
    };

    //STEP 6: Use the createParticipant method on your instance of ParticipantsClient and pass the ParticipantRequest object we created in Step 5. This will return a Participant object with a ParticipantID that can be used to create our StreamingAnalyzeContent request to DialogFlow CX
    const [participant] = await participantsClient.createParticipant(
      participantRequest
    );
    console.log(participant); //Log the participant JSON

    const participantParentPath = participant.name;
    console.log('participtParentPath: ' + participantParentPath);
    participantID = participantParentPath.substring(
      participantParentPath.lastIndexOf('/') + 1
    );
    console.log('participantID: ' + participantID);

    participantConfig = `projects/${process.env.DIALOGFLOW_CX_PROJECT_ID}/locations/${process.env.DIALOGFLOW_CX_LOCATION}/conversations/${conversationID}/participants/${participantID}`;

    console.log('Participant Config: ' + participantConfig);

    //https://cloud.google.com/dialogflow/priv/docs/reference/rpc/google.cloud.dialogflow.v2beta1#google.cloud.dialogflow.v2beta1.EventInput
    const welcomeIntentEventInput = {
      name: 'WELCOME',
      languageCode: 'en-US',
    };

    let analyzeContentWelcomeRequest = {
      participant: participantConfig,
      eventInput: welcomeIntentEventInput,
      replyAudioConfig: replyAudioConfig,
    };

    const [tempWelcomeIntentResponse] = await participantsClient.analyzeContent(
      analyzeContentWelcomeRequest
    );
    console.log('Welcome Intent');
    console.log(tempWelcomeIntentResponse);
    welcomeIntentResponse = tempWelcomeIntentResponse;
  } catch (err) {
    console.log(err);
  }
}

createDialogFlowConversation();

function createDetectStream(isFirst, audioDuration) {
  console.log('conversationID in createDetectStream: ' + conversationID);
  console.log('participantID in createDetectStream: ' + participantID);
  //console.log('welcome intent: ' + welcomeIntentResponse.replyText);

  const tempParticipantConfig = `projects/${process.env.DIALOGFLOW_CX_PROJECT_ID}/locations/${process.env.DIALOGFLOW_CX_LOCATION}/conversations/${conversationID}/participants/${participantID}`;

  const tempAudioConfig = {
    audioEncoding: 'AUDIO_ENCODING_MULAW',
    sampleRateHertz: 8000,
    languageCode: 'en-us',
    //model: 'phone_call',
    modelVariant: 'USE_ENHANCED',
    singleUtterance: true,
    bargeInConfig: {
      noBargeInDuration: {
        seconds: audioDuration,
      },
      totalDuration: {
        seconds: 30,
      },
    },
  };

  const tempReplyAudioConfig = {
    audioEncoding: 'OUTPUT_AUDIO_ENCODING_LINEAR_16',
    sampleRateHertz: 16000,
  };

  let streamingAnalyzeContentRequest = {
    participant: tempParticipantConfig,
    audioConfig: tempAudioConfig,
    replyAudioConfig: tempReplyAudioConfig,
  };

  const detectStream = participantsClient.streamingAnalyzeContent();
  detectStream.write(streamingAnalyzeContentRequest);

  return detectStream;
}

function createAudioResponseStream() {
  console.log('in AudioResponseStream');
  return new Transform({
    objectMode: true,
    transform: (chunk, encoding, callback) => {
      console.log(chunk);
      if (!chunk.replyAudio || chunk.replyAudio.length == 0) {
        return callback();
      }
      // Convert the LINEAR 16 Wavefile to 8000/mulaw
      const wav = new WaveFile();
      wav.fromBuffer(chunk.replyAudio.audio);
      wav.toSampleRate(8000);
      wav.toMuLaw();
      return callback(null, Buffer.from(wav.data.samples));
    },
  });
}

function createAudioRequestStream() {
  console.log('in AudioRequestStream');
  return new Transform({
    objectMode: true,
    transform: (chunk, encoding, callback) => {
      const msg = JSON.parse(chunk.toString('utf8'));
      // Only process media messages
      if (msg.event !== 'media') return callback();
      // This is mulaw/8000 base64-encoded
      return callback(null, { inputAudio: msg.media.payload });
    },
  });
}

class DialogflowService extends EventEmitter {
  constructor() {
    super();
    // State management
    this.isFirst = true;
    this.isReady = false;
    this.isStopped = false;
    this.isInterrupted = false;
  }

  send(message) {
    const stream = this.startPipeline();
    stream.write(message);
  }

  getFinalQueryResult() {
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
      //new variable for cx to calculate the duration of the audio sent back from google so that we can apply the correct barge-in
      this.audioDuration = 5; //TBD - Hard Coded for now

      // Generate the streams
      this._requestStream = new PassThrough({ objectMode: true });
      this.audioStream = createAudioRequestStream();
      this.detectStream = new PassThrough({ objectMode: true });
      //this.detectStream = createDetectStream(this.isFirst, this.audioDuration);
      this.responseStream = new PassThrough({ objectMode: true });
      this.audioResponseStream = createAudioResponseStream();

      //this.detectStream = new PassThrough({ objectMode: true });
      if (this.isFirst) {
        this.isFirst = false;
        // // isFirst trigger has to be moved here because you need to setup the other streams first
        // this.detectStream.write({ inputText: 'hello' });
        this.detectStream.write(welcomeIntentResponse);
      } else {
        // this._requestStream = new PassThrough({ objectMode: true });
        // this.audioStream = createAudioRequestStream();
        this.detectStream = createDetectStream(
          this.isFirst,
          this.audioDuration
        );
      }
      this.isInterrupted = false;

      // Pipeline is async....
      pipeline(
        this._requestStream,
        this.audioStream,
        this.detectStream,
        this.responseStream,
        this.audioResponseStream,
        (err) => {
          if (err) {
            this.emit('error', err);
          }
          // Update the state so as to create a new pipeline
          this.isReady = false;
        }
      );

      this._requestStream.on('data', (data) => {
        //console.log('requestStream - data');
        const msg = JSON.parse(data.toString('utf8'));
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
          data.recognitionResult &&
          data.recognitionResult.messageType === 'END_OF_SINGLE_UTTERANCE'
        ) {
          console.log(
            `Ending interaction with: ${data.recognitionResult.transcript}`
          );
          //this.finalQueryResult = data.recognitionResult;
          //this.stop();
        }
      });
      this.audioResponseStream.on('data', (data) => {
        console.log('audioResponseStream - data');
        console.log(data);
        this.emit('audio', data.toString('base64'));
        // to trigger reset stream
        this.isReady = false;
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
    this.isStopped = true;
    this._requestStream.end();
  }
}

module.exports = {
  DialogflowService,
};
