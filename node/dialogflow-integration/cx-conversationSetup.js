require('dotenv').config();
const {
  ConversationsClient,
  ConversationProfilesClient,
  ParticipantsClient,
} = require('@google-cloud/dialogflow');

const conversationsRequest = {
  parent: `projects/cfeehantwiliocxintegration/locations/us-central1`,
  conversation: {
    conversationProfile: `projects/cfeehantwiliocxintegration/locations/us-central1/conversationProfiles/${process.env.DIALOGFLOW_CX_CONVERSATION_PROFILE_ID}`,
  },
};

const conversationsClient = new ConversationsClient({
  apiEndpoint: `us-central1-dialogflow.googleapis.com`,
});

async function conversations() {
  try {
    console.log('before');
    const [result] = await conversationsClient.createConversation(
      conversationsRequest
    );
    console.log(result);
    console.log('after');
  } catch (err) {
    console.log(err);
  }
}

conversations();
