require('dotenv').config();
const {
  ConversationsClient,
  ConversationProfilesClient,
  ParticipantsClient,
} = require('@google-cloud/dialogflow');

const conversationCompleteRequest = {
  name: `projects/cfeehantwiliocxintegration/locations/us-central1/conversations/119jr13g6mDTfysaI1z_vwFRw`,
};

const conversationsClient = new ConversationsClient({
  apiEndpoint: `us-central1-dialogflow.googleapis.com`,
});

async function conversationComplete() {
  try {
    console.log('before');
    const [result] = await conversationsClient.completeConversation(
      conversationCompleteRequest
    );
    console.log(result);
    console.log('after');
  } catch (err) {
    console.log(err);
  }
}

conversationComplete();
