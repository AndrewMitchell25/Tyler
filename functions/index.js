const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();

const dbRef = admin.firestore().collection('tokens');

async function createTC(){
    const keys = await dbRef.doc('keys').get();
    const { clientID, clientSecret } = keys.data();

    const TwitterApi = require('twitter-api-v2').default;
    const twitterClient = new TwitterApi({
        clientId: clientID,
        clientSecret: clientSecret,
        });
    return twitterClient;
}


const callbackURL = 'http://127.0.0.1:5000/tyler-76c59/us-central1/callback';

exports.auth = functions.https.onRequest(async (request, response) => {
    const twitterClient = await createTC();

    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        {scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access']}
        );
        
    
    //store verifier
    await dbRef.doc('data').set({ codeVerifier, state });

    response.redirect(url);

});

exports.callback = functions.https.onRequest(async (request, response) => {
    const twitterClient = await createTC();

    const { state, code } = request.query;

    const dbSnapshot = await dbRef.doc('data').get();
    const { codeVerifier, state: storedState } = dbSnapshot.data();

    if (state != storedState) {
        return response.status(400).send('Stored tokens do not match!');
    }

    const {
        client: loggedClient,
        accessToken,
        refreshToken,
    } = await twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackURL,
    });

    await dbRef.doc('access').set({ accessToken, refreshToken });

    response.sendStatus(200);

});

exports.tweet = functions.https.onRequest((request, response) => {
    
});
