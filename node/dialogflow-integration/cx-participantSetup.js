require('dotenv').config();
const {
  ConversationsClient,
  ConversationProfilesClient,
  ParticipantsClient,
} = require('@google-cloud/dialogflow');

const participantRequest = {
  parent: `projects/cfeehantwiliocxintegration/locations/us-central1/conversations/119jr13g6mDTfysaI1z_vwFRw`,
  participant: {
    role: 'END_USER',
  },
};

const participantsClient = new ParticipantsClient({
  apiEndpoint: `us-central1-dialogflow.googleapis.com`,
});

async function participant() {
  try {
    console.log('before');
    const [result] = await participantsClient.createParticipant(
      participantRequest
    );
    console.log(result);
    console.log('after');
  } catch (err) {
    console.log(err);
  }
}

participant();
