// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

//Use to get timestamp
var FieldValue = require("firebase-admin").FieldValue;

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

const firestore = admin.firestore();

const adminFunctions = require('./admin');
exports.createAccount = adminFunctions.createAccount;

//region ==== On Create ====


//endregion

//region ==== On Update ====


//endregion

//region ==== On Delete ====
exports.onDeleteUserDeleteFirebaseUser = functions.firestore.document('Users/{userId}')
    .onDelete((snap, context) => {
        console.log("Delete Firebase User : " + context.params.userId);
        return admin.auth().deleteUser(context.params.userId);
        //TODO Same with targetId
    });
//endregion
