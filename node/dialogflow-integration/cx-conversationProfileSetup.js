require('dotenv').config();
const {
  ConversationsClient,
  ConversationProfilesClient,
  ParticipantsClient,
} = require('@google-cloud/dialogflow');

const conversationProfileRequest = {
  parent: `projects/${process.env.DIALOGFLOW_CX_PROJECT_ID}/locations/us-central1`,
  conversationProfile: {
    displayName: 'Random Agent Name',
    automatedAgentConfig: {
      agent: `projects/${process.env.DIALOGFLOW_CX_PROJECT_ID}/locations/us-central1/agents/${process.env.DIALOGFLOW_CX_AGENT_ID}`,
    },
  },
};

const conversationProfilesClient = new ConversationProfilesClient({
  apiEndpoint: `us-central1-dialogflow.googleapis.com`,
});

async function conversationProfile() {
  try {
    console.log('before');
    const [result] = await conversationProfilesClient.createConversationProfile(
      conversationProfileRequest
    );
    console.log(result);
    console.log('after');
  } catch (err) {
    console.log(err);
  }
}

conversationProfile();
