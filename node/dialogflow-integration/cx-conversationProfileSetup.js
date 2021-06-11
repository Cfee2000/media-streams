require('dotenv').config();
const {
  ConversationsClient,
  ConversationProfilesClient,
  ParticipantsClient,
} = require('@google-cloud/dialogflow');

const conversationProfileRequest = {
  parent: `projects/cfeehantwiliocxintegration/locations/us-central1`,
  conversationProfile: {
    displayName: 'Random Agent Name',
    automatedAgentConfig: {
      agent: `projects/cfeehantwiliocxintegration/locations/us-central1/agents/c8613d53-f3b7-49c0-be4c-4787fc85f9dc`,
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
async function getProjectID() {
  const result = await conversationProfilesClient.getProjectId();
  console.log('project id: ' + result);
}

getProjectID();

//console.log(conversationProfilesClient);

// conversationProfilesClient
//   .createConversationProfile(createConversationProfileRequest)
//   .then(([response]) => {
//     console.log(response.displayName);
//   })
//   .catch((error) => {
//     console.log(error);
//   });
// conversationProfilesClient
//   .getConversationProfile(getConversationProfileRequest)
//   .then(([response]) => {
//     console.log(response.displayName);
//   });

// conversationProfilesClient
//   .listConversationProfiles(createConversationProfileRequest)
//   .then(([response]) => {
//     for (const [index, conversationProfile] of response.entries()) {
//       console.log(conversationProfile.displayName);
//     }
//   })
//   .catch((error) => {
//     console.log(error);
//   });

const getConversationProfileRequest = {
  name: 'Chris Feehan Agent',
};

const listConversationProfileRequest = {
  parent: `projects/${process.env.DIALOGFLOW_CX_PROJECT_ID}/locations/us-central1`,
};
// const conversationsClient = new ConversationsClient({
//   apiEndpoint: `${process.env.DIALOGFLOW_CX_LOCATION}-dialogflow.googleapis.com`,
//   projectId: process.env.DIALOGFLOW_CX_PROJECT_ID,
// });

// conversationsClient.crea;
// console.log(conversationsClient);

// let result = conversationProfilesClient.CreateConversationProfile();

// let profile = conversationProfilesClient.createConversationProfile();

//const { ConversationsClient, ConversationProfilesClient, ParticipantsClient } = require('@google-cloud/dialogflow').v2beta1;
