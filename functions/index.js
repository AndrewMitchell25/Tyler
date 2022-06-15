const fetch = require("node-fetch");

const functions = require("firebase-functions");
const admin = require('firebase-admin');
const { https } = require("firebase-functions/v1");
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

async function getQuote(){
    const response = await fetch('https://programming-quotes-api.herokuapp.com/Quotes/random');
    const quoteJson = await response.json();
    
    let quote = "\"" + quoteJson["en"] + "\"" + "\n\t- " + quoteJson["author"];
    
    return quote;
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

    console.log(state);

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

exports.tweet = functions.https.onRequest(async (request, response) => {
    const twitterClient = await createTC();

    const { refreshToken } = (await dbRef.doc('access').get()).data();

    const {
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await dbRef.doc('access').set({ accessToken, refreshToken: newRefreshToken });

    //first ever tweet
    //const nextTweet = 'Hello there. I\'m Tyler the Twitter Bot.';

    const nextTweet = await getQuote();

    const { data } = await refreshedClient.v2.tweet(nextTweet);
    response.send(data);

});
