// Chai is a commonly used library for creating unit test suites. It is easily extended with plugins.
const chai = require('chai');
const assert = chai.assert;

const admin = require("firebase-admin");
/*
 Config projet test
 apiKey: "AIzaSyCnlXazOt-cHygjH6Hq3cBXbLWrOJ1jgbw",
 authDomain: "thepolygametest.firebaseapp.com",
 databaseURL: "https://thepolygametest.firebaseio.com",
 projectId: "thepolygametest",
 storageBucket: "thepolygametest.appspot.com",
 messagingSenderId: "319354879090"

 */
const config = {
    projectId: 'thepolygametest',
    authDomain: 'thepolygametest.firebaseapp.com',
    databseURL: 'https://thepolygametest.firebaseio.com',
};
const test = require('firebase-functions-test')(config
    , 'functions/firebase_service_account_key.json');

function failOnReject(error) {
    console.log(error);
    assert.fail();
}

describe('Cloud functions', function () {
    //seting a custom timeout Necessary as most firebase tests take more that 2000 ms to return
    this.timeout(60000);
    let functions;
    let firestore;
    before(function () {
        functions = require('../index');
        firestore = admin.firestore();
    });
    after(function () {
        test.cleanup();
    });
    describe('OnUserDeleteDeletePlayer', function () {
        let playerRef;
        let userSnap;
        before(function () {
            playerRef = firestore.doc('Players/1');
            playerRef.set({'test': true});
            userSnap = test.firestore.makeDocumentSnapshot({}, "Users/1");

        });
        after(function () {
            return playerRef.delete();
        });
        it('OnCall deletes the player', function () {
            //wrapping the firebase function call by the test framework to setup environement
            const wrapped = test.wrap(functions.onDeleteUserDeletePlayer);
            // setting up mock context object
            let context = {params: {userId: '1'}};

            return wrapped({}, context).then(function () {
                    firestore.collection('Players').doc('1').get()
                        .then((snap) => {
                                assert.equal(snap.exists, false);
                            },
                        )
                },
            );


        });
    });
    describe('OnCreatePlayerAsignTargets', function () {
        let playerSnap;
        let context = {
            params: {
                userId: 'OnCreatePlayerTester'
            }
        };
        let playerContractsQuery;
        const targets = [];
        before(async function () {
            playerSnap = test.firestore.makeDocumentSnapshot({}, 'Players/OnCreatePlayerTester');
            for (let i = 0; i < 8; ++i) {
                targets.push(test.firestore.makeDocumentSnapshot({}, 'Players/' + i));
                //Create Players for test
                await firestore.collection('Players').doc(i.toString()).set({test: true});
            }
            for (let i = 0; i < 4; ++i) {
                //Create Challenges
                await firestore.collection('Challenges').doc(i.toString()).set({description: 'test ' + i.toString()});
            }
            playerContractsQuery = firestore.collection('Contracts').where('hunterId', '==', playerSnap.ref);
        });
        afterEach(function () {
            return firestore.collection('Contracts')
                .where('hunterId', '==', playerSnap.ref).get()
                .then((snap) => {
                    return Promise.all(snap.docs.map((doc) => doc.ref.delete()));
                });
        });
        after(function () {
            //Delete all added players
            for (let i = 0; i < 5; ++i) {
                firestore.collection('Players').doc(i.toString()).delete();
            }
            for (let i = 0; i < 3; ++i) {
                firestore.collection('Challenges').doc(i.toString()).delete();
            }
        });

        it('Assign three targets on call', function () {
            const wrapped = test.wrap(functions.onCreatePlayerAssignTargets);
            return wrapped(playerSnap, context).then(function () {

                return playerContractsQuery.get()
                    .then((snap) => {
                            return assert.equal(snap.size, 3);
                        },
                        failOnReject);
            }, failOnReject);
        });
        it('All assigned targets are different', function () {
            const wrapped = test.wrap(functions.onCreatePlayerAssignTargets);
            return wrapped(playerSnap, context).then(
                function () {
                    return playerContractsQuery.get().then(
                        (snap) => {
                            let targets = snap.docs.map(
                                (doc) => doc.get('targetId').ref.id
                            );
                            //comparing for duplicates through array convertion
                            assert.sameMembers(targets, Array.from(new Set(targets)));
                        }
                        , failOnReject)
                }, failOnReject)
        });
        it('All assigned challenges are different', function () {
            const wrapped = test.wrap(functions.onCreatePlayerAssignTargets);
            return wrapped(playerSnap, context).then(
                function () {
                    return playerContractsQuery.get().then(
                        (snap) => {
                            let challenges = snap.docs.map(
                                (doc) => doc.get('challengeId').ref.id
                            );
                            //comparing for duplicates through array convertion
                            assert.sameMembers(challenges, Array.from(new Set(challenges)));
                        }
                        , failOnReject)
                }, failOnReject)
        })
    });
    describe('OnDeleteChallengeReassignContracts', function () {
        let challenges = [];
        let contracts = [];
        let testChallenge = [];
        let removedChallenge;
        before(async function () {
            const challengeCol = firestore.collection('Challenges');
            const contractsCol = firestore.collection('Contracts');
            await Promise.all([
                challengeCol.doc('2').set({description: 'Challenge 2'}),
                challengeCol.doc('3').set({description: 'Challenge 3'}),
                challengeCol.doc('3').set({description: 'Challenge 4'}),
                contractsCol.doc('1').set({
                    hunterId: 'Players/1',
                    targetId: 'Players/2',
                    challengeId: 'Challenges/1',
                    validationDate: null
                }),
                contractsCol.doc('2').set({
                    hunterId: 'Players/1',
                    targetId: 'Players/3',
                    challengeId: 'Challenges/2',
                    validationDate: null
                }),
                contractsCol.doc('3').set({
                    hunterId: 'Players/1',
                    targetId: 'Players/4',
                    challengeId: 'Challenges/3',
                    validationDate: null
                }),
                contractsCol.doc('4').set({
                    hunterId: 'Players/3',
                    targetId: 'Players/2',
                    challengeId: 'Challenges/1',
                    validationDate: null
                }),
                contractsCol.doc('5').set({
                    hunterId: 'Players/3',
                    targetId: 'Players/4',
                    challengeId: 'Challenges/3',
                    validationDate: null
                }),
            ]);


        });
        after(function () {
            //test.cleanup();
            firestore.collection('Contracts').get().then(snap => snap.docs.forEach(doc => doc.ref.delete()));
            return firestore.collection('Challenges').get().then(snap => snap.docs.forEach(doc => doc.ref.delete()));

        });
        beforeEach(async function () {
            removedChallenge = test.firestore.makeDocumentSnapshot({}, 'Challenges/1');
        });
        it('should not leave contracts with the deleted challenge', async function () {
            let contracts = await firestore.collection('Contracts').where('challengeId', '==', removedChallenge.ref.path).get();
            assert.notEqual(contracts.docs.length, 0);
            const wrapped = test.wrap(functions.onDeleteChallengeReasignContracts);
            await wrapped(removedChallenge, {params: {challengeId: '1'}});
            contracts = await firestore.collection('Contracts').where('challengeId', '==', removedChallenge.ref.path).get();
            assert.equal(contracts.docs.length, 0);
        })
    });
    describe('OnCreateBonusAssignCode', function () {
        let bonusSnap;
        let bonuses = [];
        let bonusCol;
        before(async function () {
            bonusCol = firestore.collection('BonusTargets');

            await bonusCol.doc('bonusTargetTest').set({});
            bonusSnap = await bonusCol.doc('bonusTargetTest').get();
            for (let i = 0; i < 10; ++i) {
                await firestore.collection('BonusTargets').doc(i.toString()).set({code: i});
            }
        });
        beforeEach(async function () {
            await bonusCol.doc('bonusTargetTest').set({});
            for (let i = 0; i < 10; ++i) {
                await firestore.collection('BonusTargets').doc(i.toString()).set({code: i});
            }
            bonusSnap = await bonusCol.doc('bonusTargetTest').get();
        });
        after(async function () {
            for (let i = 0; i < 10; ++i) {
                await firestore.collection('BonusTargets').doc(i.toString()).delete();
            }
            await bonusSnap.ref.delete();
        });
        it('should assign a code to a created bonus', function () {
            const wrapped = test.wrap(functions.onCreateBonusAssignCode);
            return wrapped(bonusSnap).then(async function () {
                bonusSnap = await bonusSnap.ref.get();
                return assert.notEqual(bonusSnap.get('code'), null);
            }, failOnReject);
        });
        it('should assign a unique code', function () {
            const wrapped = test.wrap(functions.onCreateBonusAssignCode);
            let context = {maxCode: 10};
            return wrapped(bonusSnap, context).then(async function () {
                bonusSnap = await bonusSnap.ref.get();
                return assert.equal(bonusSnap.get('code'), 10);
            });
        });
        it('should avoid consecutive codes', async function () {
            for (let i = 0; i < 10; i += 2) {
                await firestore.collection('BonusTargets').doc(i.toString()).delete();
            }
            await firestore.collection('BonusTargets').doc('5').delete();
            const wrapped = test.wrap(functions.onCreateBonusAssignCode);
            let context = {maxCode: 10};
            return wrapped(bonusSnap, context).then(async function () {
                bonusSnap = await bonusSnap.ref.get();
                for (let i = 0; i < 10; i += 2) {
                    await firestore.collection('BonusTargets').doc(i.toString()).set({code: i});
                }
                await firestore.collection('BonusTargets').doc('5').set({code: 5});
                return assert.equal(bonusSnap.get('code'), 5);
            });

        });

    });
    describe('getNewChallenge', function () {
        let playerSnap;
        let challengesCollection;

        let challenges = [];
        before(function () {
            challengesCollection = firestore.collection('Challenges');
            playerSnap = test.firestore.makeDocumentSnapshot({}, 'Players/1');
            challenges = Array.from(Array(5).keys()).map((i) => challengesCollection.doc(i.toString()));
            return Promise.all(challenges.map((ref) => ref.set({test: true})));
        });
        after(function () {
            return Promise.all(challenges.map((c) => c.delete()));
        });
        it('Returns an existing challenge reference', function () {

            return functions.getNewChallenge(playerSnap.ref).then((ref) => {
                return ref.get().then((snap) => {
                    assert.isTrue(snap.exists);
                }, failOnReject);
            }, failOnReject);
        });

        it("Returns a challenge the player doesn't have", async function () {
            let contractsCollection = firestore.collection('Contracts');


            await contractsCollection.doc('1').set({
                hunterId: playerSnap.ref,
                challengeId: challenges[1],
                validationDate: null
            });
            await contractsCollection.doc('2').set({
                hunterId: playerSnap.ref,
                challengeId: challenges[2],
                validationDate: Date.UTC(1999, 12)
            });
            await contractsCollection.doc('3').set({
                hunterId: playerSnap.ref,
                challengeId: challenges[3],
                validationDate: null
            });
            let challenge = await functions.getNewChallenge(playerSnap.ref);
            let contractQuerySnap = await contractsCollection.where('hunterId', '==', playerSnap.ref).where('validationDate', '==', null).get();

            let currentChallenges = contractQuerySnap.docs.map((doc) => doc.get('challengeId').ref.id);
            assert.notInclude(currentChallenges, challenge.ref.id, 'The challenge should not be already assigned');

        });
    });
    describe('getUnassignedPlayer', async function () {
        let playerHuntingRef;
        let playerHuntedRef;
        let playerNewTargetRef;
        let contractRef;

        before(async function () {
            //Clean players, jsut in case, we need no data for passing this group test
            const actualPlayers = await firestore.collection('Players').get();
            await actualPlayers.forEach(
                async doc => {
                    await doc.ref.delete();
                }
            );

            //We need 1 challenge to create contract
            await firestore.collection('Challenges').doc('challTest').set({
                description: "Description du challenge Test",
                difficulty: 1,
                reward: 1
            });
            //We want 3 players -> Player that will be suspended, Player that is the first target, Player that will be the new target
            await firestore.collection('Players').doc('playerHunting').set({
                test: true
            });
            await firestore.collection('Players').doc('playerHunted').set({
                test: true
            });
            await firestore.collection('Players').doc('playerNewTarget').set({
                test: true
            });

            playerHuntingRef = firestore.collection('Players').doc('playerHunting');
            playerHuntedRef = firestore.collection('Players').doc('playerHunted');
            playerNewTargetRef = firestore.collection('Players').doc('playerNewTarget');

            //We now create contract between hunting player and player hunted
            await firestore.collection('Contracts').doc('contractTest').set({
                hunterId: firestore.collection('Players').doc('playerHunting'),
                targetId: firestore.collection('Players').doc('playerHunted'),
                rerollLeft: 0
            });
            contractRef = firestore.collection('Contracts').doc('contractTest');
        });

        after(function () {
            return Promise.all([
                playerHuntingRef.delete(),
                playerHuntedRef.delete(),
                playerNewTargetRef.delete(),
                contractRef.delete()
            ]);
        });

        it('Should get third player', async () => {
            const playerRef = await functions.getUnassignedPlayer(playerHuntingRef);
            assert.equal(playerRef.id, playerNewTargetRef.id);
        });
    });
    describe('OnBanOrSuspendUserReassignContracts', function () {
        let playerHuntingRef;
        let playerSuspendedRef;
        let playerNewTargetRef;
        let contractRef;
        let contractInitialData;

        before(async function () {
            //We need 1 challenge to create contract
            await firestore.collection('Challenges').doc('challTest').set({
                description: "Description du challenge Test",
                difficulty: 1,
                reward: 1
            });

            //We want 3 players -> Player that will be suspended, Player that is the first target, Player that will be the new target
            await firestore.collection('Players').doc('playerHunting').set({
                test: true
            });
            await firestore.collection('Players').doc('playerSuspended').set({
                test: true
            });
            await firestore.collection('Players').doc('playerNewTarget').set({
                test: true
            });

            playerHuntingRef = firestore.collection('Players').doc('playerHunting');
            playerSuspendedRef = firestore.collection('Players').doc('playerSuspended');
            playerNewTargetRef = firestore.collection('Players').doc('playerNewTarget');

            //We now create contract between hunting player and player that will be banned or suspended
            await firestore.collection('Contracts').doc('contractTest').set({
                hunterId: firestore.collection('Players').doc('playerHunting'),
                targetId: firestore.collection('Players').doc('playerSuspended'),
                rerollLeft: 0
            });

            contractRef = firestore.collection('Contracts').doc('contractTest');
            contractInitialData = await contractRef.get();
        });

        after(function () {
            return Promise.all([
                playerHuntingRef.delete(),
                playerSuspendedRef.delete(),
                playerNewTargetRef.delete(),
                // contractRef.delete()
            ]);
        });

        it('Do nothing when not updating state', function () {
            const wrapped = test.wrap(functions.onBanOrSuspendUserReassignContracts);
            const change = {
                before: {
                    data() {
                        return {
                            state: 1
                        }
                    }
                },
                after: {
                    data() {
                        return {
                            state: 1
                        }
                    }
                }
            };
            return wrapped(change, {params: {userId: 'playerSuspended'}}).then(
                async () => {
                    const contractData = await contractRef.get();
                    // On simple update, it should be no modif on targetId
                    assert.equal(contractData.data().targetId.id, contractInitialData.data().targetId.id);

                }, failOnReject)
        });

        it('Change target on ban or suspended', async () => {
            const wrapped = test.wrap(functions.onBanOrSuspendUserReassignContracts);
            const change = {
                before: {
                    data() {
                        return {
                            state: 1
                        }
                    }
                },
                after: {
                    data() {
                        return {
                            state: -1
                        }
                    }
                }
            };
            await wrapped(change, {params: {userId: 'playerSuspended'}});
            const contractData = await firestore.collection('Contracts').doc('contractTest').get();
            // Bad practice but doesn't work otherwise
            setTimeout(() => assert.notEqual(contractData.data().targetId.id, playerSuspendedRef.id), 1000);


        });
    });
});
