require('dotenv').config();
const {
  ConversationsClient,
  ParticipantsClient,
} = require('@google-cloud/dialogflow');

console.log(`${process.env.DIALOGFLOW_CX_CONVERSATION_PROFILE_ID}`);
console.log(`${process.env.DIALOGFLOW_CX_API_ENDPOINT}`);

//Now that the call is in-progress, spin up the DialogFlow CX Conversation
//PRE-REQUISITE: A one-time setup for a DialogflowCX ConversationProfile will need to be created (see cx-conversationProfileSetup.js)

//STEP 1: Create a new instance of a ConversationsClient and ParticipantsClient and provide the apiEndpoint
const conversationsClient = new ConversationsClient({
  apiEndpoint: process.env.DIALOGFLOW_CX_API_ENDPOINT,
});
const participantsClient = new ParticipantsClient({
  apiEndpoint: process.env.DIALOGFLOW_CX_API_ENDPOINT,
});

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
    const conversationID = convoParentPath.substring(
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
    const participantID = participantParentPath.substring(
      participantParentPath.lastIndexOf('/') + 1
    );
    console.log('participantID: ' + participantID);

    //****************** CLOSE CONVERSATION *******************/
    const conversationCompleteRequest = {
      name: `projects/${process.env.DIALOGFLOW_CX_PROJECT_ID}/locations/${process.env.DIALOGFLOW_CX_LOCATION}/conversations/${conversationID}`,
    };

    const [complete] = await conversationsClient.completeConversation(
      conversationCompleteRequest
    );
    console.log('after conversation complete');
    console.log(complete);
  } catch (err) {
    console.log(err);
  }
}

createDialogFlowConversation();
