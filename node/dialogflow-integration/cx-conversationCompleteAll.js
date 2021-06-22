require('dotenv').config();
const {
  ConversationsClient,
  ConversationProfilesClient,
  ParticipantsClient,
} = require('@google-cloud/dialogflow');

const conversationsListRequest = {
  parent: `projects/cfeehantwiliocxintegration/locations/us-central1`,
};

const conversationsClient = new ConversationsClient({
  apiEndpoint: `us-central1-dialogflow.googleapis.com`,
});

async function conversationCompleteAll() {
  try {
    const [allConversations] = await conversationsClient.listConversations(
      conversationsListRequest
    );

    console.log('Size of Array: ' + allConversations.length);
    for (const [index, conversation] of allConversations.entries()) {
      console.log(conversation); //Log the conversation JSON

      const convoParentPath = conversation.name;
      console.log('convoParentPath: ' + convoParentPath);
      const conversationID = convoParentPath.substring(
        convoParentPath.lastIndexOf('/') + 1
      );
      console.log('conversationID: ' + conversationID);

      let conversationCompleteRequest = {
        name: `projects/cfeehantwiliocxintegration/locations/us-central1/conversations/${conversationID}`,
      };

      const [result] = await conversationsClient.completeConversation(
        conversationCompleteRequest
      );
      console.log(result);
    }
  } catch (err) {
    console.log(err);
  }
}

conversationCompleteAll();
